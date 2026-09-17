import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, mongo, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { AuditLogService } from '../audit-log/audit-log.service';
import { User } from '../users/schemas/user.schema';
import { clampPagination, PaginatedResult } from '../../common/pagination/paginated-result';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import {
  ACCEPTED_EXTENSIONS,
  duplicateName,
  MAX_DOCUMENT_BYTES,
  resolveFileType,
  sanitizeFileName
} from './document-types';
import { DocumentFolder } from './schemas/document-folder.schema';
import { StoredDocument } from './schemas/document.schema';
import { ImageProcessor } from './image.service';
import { OcrService } from './ocr.service';

export const DOCUMENT_BUCKET = 'documentfiles';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DocumentListItem extends Record<string, unknown> {
  uploadedByName: string;
}

export interface FolderListItem {
  _id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  createdAt?: Date;
}

const ROOT = 'root';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly repo: TenantScopedRepository<StoredDocument>;
  private readonly folderRepo: TenantScopedRepository<DocumentFolder>;

  constructor(
    @InjectModel(StoredDocument.name) private readonly documents: Model<StoredDocument>,
    @InjectModel(DocumentFolder.name) private readonly folders: Model<DocumentFolder>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditLog: AuditLogService,
    private readonly ocr: OcrService,
    private readonly images: ImageProcessor
  ) {
    this.repo = new TenantScopedRepository(documents);
    this.folderRepo = new TenantScopedRepository(folders);
  }

  private get bucket(): mongo.GridFSBucket {
    const db = this.connection.db;
    if (!db) throw new Error('Mongo connection is not ready');
    return new mongo.GridFSBucket(db, { bucketName: DOCUMENT_BUCKET });
  }

  // ---------------------------------------------------------------- folders

  async listFolders(ctx: TenantContext): Promise<FolderListItem[]> {
    const [folders, counts] = await Promise.all([
      this.folderRepo.find(ctx).sort({ name: 1 }).lean(),
      this.documents.aggregate<{ _id: string | null; count: number }>([
        { $match: { tenantId: ctx.tenantId } },
        { $group: { _id: '$folderId', count: { $sum: 1 } } }
      ])
    ]);

    const countMap = new Map(counts.map((entry) => [entry._id ?? ROOT, entry.count]));
    return folders.map((folder) => ({
      _id: String(folder._id),
      name: folder.name,
      parentId: folder.parentId ?? null,
      documentCount: countMap.get(String(folder._id)) ?? 0,
      createdAt: (folder as { createdAt?: Date }).createdAt
    }));
  }

  async createFolder(ctx: TenantContext, dto: CreateFolderDto) {
    const parentId = await this.resolveFolderId(ctx, dto.parentId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('A mappa neve nem lehet üres');

    try {
      return await this.folders.create({
        tenantId: ctx.tenantId,
        name,
        parentId,
        createdBy: ctx.userId
      });
    } catch (error) {
      throw this.asFolderConflict(error, name);
    }
  }

  async updateFolder(ctx: TenantContext, id: string, dto: UpdateFolderDto) {
    const folder = await this.folderRepo.findById(ctx, id);
    if (!folder) throw new NotFoundException('A mappa nem található');

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('A mappa neve nem lehet üres');
      update.name = name;
    }

    if (dto.parentId !== undefined) {
      const parentId = await this.resolveFolderId(ctx, dto.parentId);
      if (parentId === id) throw new BadRequestException('A mappa nem lehet a saját szülője');
      if (parentId && (await this.isDescendant(ctx, id, parentId))) {
        throw new BadRequestException('A mappa nem helyezhető a saját almappájába');
      }
      update.parentId = parentId;
    }

    if (Object.keys(update).length === 0) return folder;

    try {
      return await this.folderRepo.updateById(ctx, id, update);
    } catch (error) {
      throw this.asFolderConflict(error, String(update.name ?? folder.name));
    }
  }

  /** Deletes a folder together with every subfolder and document inside it. */
  async deleteFolder(ctx: TenantContext, id: string) {
    const folder = await this.folderRepo.findById(ctx, id);
    if (!folder) throw new NotFoundException('A mappa nem található');

    const folderIds = await this.subtreeIds(ctx, id);
    const documents = await this.repo.find(ctx, { folderId: { $in: folderIds } }).lean();

    for (const document of documents) {
      await this.deleteStoredFile(document.fileId);
      if (document.thumbnailFileId) await this.deleteStoredFile(document.thumbnailFileId);
    }

    await this.documents.deleteMany({ tenantId: ctx.tenantId, folderId: { $in: folderIds } });
    await this.folders.deleteMany({
      tenantId: ctx.tenantId,
      _id: { $in: folderIds.map((value) => new Types.ObjectId(value)) }
    });

    void this.auditLog.record({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: 'document.folder.delete',
      entityType: 'DocumentFolder',
      entityId: id,
      metadata: { name: folder.name, folders: folderIds.length, documents: documents.length }
    });

    return { deletedFolders: folderIds.length, deletedDocuments: documents.length };
  }

  // -------------------------------------------------------------- documents

  async list(ctx: TenantContext, query: ListDocumentsDto): Promise<PaginatedResult<DocumentListItem>> {
    const { page, pageSize } = clampPagination(query.page, query.pageSize);
    const filter: Record<string, unknown> = {};

    if (query.folderId) {
      filter.folderId = query.folderId === ROOT ? null : query.folderId;
    }
    if (query.kind) filter.kind = query.kind;
    if (query.tag) filter.tags = query.tag;

    const search = query.search?.trim();
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: pattern }, { originalName: pattern }, { tags: pattern }, { ocrText: pattern }];
    }

    const [items, total] = await Promise.all([
      this.repo
        .find(ctx, filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select('-ocrText')
        .lean(),
      this.documents.countDocuments({ ...filter, tenantId: ctx.tenantId })
    ]);

    const uploaderNames = await this.resolveUserNames(items.map((item) => item.uploadedBy));

    return {
      items: items.map((item) => ({
        ...item,
        uploadedByName: uploaderNames.get(item.uploadedBy) ?? 'Ismeretlen'
      })) as DocumentListItem[],
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
    };
  }

  async detail(ctx: TenantContext, id: string) {
    const document = await this.repo.findById(ctx, id).lean();
    if (!document) throw new NotFoundException('A dokumentum nem található');
    const names = await this.resolveUserNames([document.uploadedBy]);
    return { ...document, uploadedByName: names.get(document.uploadedBy) ?? 'Ismeretlen' };
  }

  async listTags(ctx: TenantContext): Promise<string[]> {
    const tags = await this.documents.distinct('tags', { tenantId: ctx.tenantId });
    return (tags as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'hu'));
  }

  async upload(ctx: TenantContext, file: UploadedFile | undefined, dto: UploadDocumentDto) {
    if (!file) throw new BadRequestException('Nem érkezett fájl');
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(
        `A fájl túl nagy (max. ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB)`
      );
    }

    const originalName = sanitizeFileName(decodeFileName(file.originalname)) || 'dokumentum';
    const type = resolveFileType(originalName, file.mimetype);
    if (!type) {
      throw new BadRequestException(
        `Nem támogatott fájltípus. Engedélyezett: ${ACCEPTED_EXTENSIONS.join(', ')}`
      );
    }

    const folderId = await this.resolveFolderId(ctx, dto.folderId);
    const stored = await this.prepareForStorage(file.buffer, type);
    const name = renameToExtension(
      sanitizeFileName(dto.name || originalName) || originalName,
      stored.extension
    );
    const checksum = createHash('sha256').update(stored.buffer).digest('hex');
    const fileId = await this.storeFile(ctx, name, stored.mimeType, stored.buffer);
    const thumbnailFileId = stored.thumbnail
      ? await this.storeFile(ctx, `thumb-${name}`, stored.thumbnail.mimeType, stored.thumbnail.buffer)
      : undefined;

    const created = await this.documents.create({
      tenantId: ctx.tenantId,
      folderId,
      name,
      originalName,
      mimeType: stored.mimeType,
      extension: stored.extension,
      kind: type.kind,
      size: stored.buffer.length,
      originalSize: stored.buffer.length === file.size ? undefined : file.size,
      fileId,
      thumbnailFileId,
      width: stored.width,
      height: stored.height,
      checksum,
      tags: parseTags(dto.tags),
      notes: dto.notes,
      uploadedBy: ctx.userId,
      ocrStatus: type.kind === 'image' ? 'none' : 'unsupported'
    });

    void this.auditLog.record({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: 'document.upload',
      entityType: 'Document',
      entityId: String(created._id),
      metadata: { name, size: stored.buffer.length, originalSize: file.size, kind: type.kind }
    });

    return created;
  }

  /**
   * Images are downscaled and re-encoded so a phone photo does not sit in the
   * database at its original size; everything else is stored verbatim.
   */
  private async prepareForStorage(
    buffer: Buffer,
    type: { kind: string; mimeType: string; extension: string }
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    extension: string;
    width?: number;
    height?: number;
    thumbnail?: { buffer: Buffer; mimeType: string };
  }> {
    if (type.kind !== 'image') {
      return { buffer, mimeType: type.mimeType, extension: type.extension };
    }

    const optimized = await this.images.optimize(buffer);
    // Keep the upload when optimisation failed, or when it made the file bigger.
    const useOptimized = optimized !== null && optimized.buffer.length < buffer.length;
    const finalBuffer = useOptimized ? optimized!.buffer : buffer;
    const thumbnail = await this.images.thumbnail(finalBuffer);

    return {
      buffer: finalBuffer,
      mimeType: useOptimized ? optimized!.mimeType : type.mimeType,
      extension: useOptimized ? optimized!.extension : type.extension,
      width: useOptimized ? optimized!.width : undefined,
      height: useOptimized ? optimized!.height : undefined,
      ...(thumbnail ? { thumbnail: { buffer: thumbnail.buffer, mimeType: thumbnail.mimeType } } : {})
    };
  }

  async update(ctx: TenantContext, id: string, dto: UpdateDocumentDto) {
    const update: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = sanitizeFileName(dto.name);
      if (!name) throw new BadRequestException('A név nem lehet üres');
      update.name = name;
    }
    if (dto.folderId !== undefined) update.folderId = await this.resolveFolderId(ctx, dto.folderId);
    if (dto.tags !== undefined) update.tags = normalizeTags(dto.tags);
    if (dto.notes !== undefined) update.notes = dto.notes;

    const updated = await this.repo.updateById(ctx, id, update);
    if (!updated) throw new NotFoundException('A dokumentum nem található');
    return updated;
  }

  /** Copies the stored bytes into a new document, optionally in another folder. */
  async duplicate(ctx: TenantContext, id: string, targetFolderId?: string) {
    const source = await this.repo.findById(ctx, id).lean();
    if (!source) throw new NotFoundException('A dokumentum nem található');

    const folderId =
      targetFolderId === undefined ? (source.folderId ?? null) : await this.resolveFolderId(ctx, targetFolderId);
    const name = duplicateName(source.name, 'másolat');
    const buffer = await this.readFile(source.fileId);
    const fileId = await this.storeFile(ctx, name, source.mimeType, buffer);
    const thumbnailFileId = source.thumbnailFileId
      ? await this.storeFile(
          ctx,
          `thumb-${name}`,
          'image/webp',
          await this.readFile(source.thumbnailFileId)
        )
      : undefined;

    const created = await this.documents.create({
      ...stripMeta(source as unknown as Record<string, unknown>),
      tenantId: ctx.tenantId,
      folderId,
      name,
      fileId,
      thumbnailFileId,
      uploadedBy: ctx.userId
    });

    void this.auditLog.record({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: 'document.duplicate',
      entityType: 'Document',
      entityId: String(created._id),
      metadata: { sourceId: id, name }
    });

    return created;
  }

  async remove(ctx: TenantContext, id: string) {
    const removed = await this.repo.deleteById(ctx, id);
    if (!removed) throw new NotFoundException('A dokumentum nem található');

    await this.deleteStoredFile(removed.fileId);
    if (removed.thumbnailFileId) await this.deleteStoredFile(removed.thumbnailFileId);

    void this.auditLog.record({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: 'document.delete',
      entityType: 'Document',
      entityId: id,
      metadata: { name: removed.name }
    });

    return { deleted: true };
  }

  /** Returns the document metadata plus a readable stream of the stored bytes. */
  async content(ctx: TenantContext, id: string) {
    const document = await this.repo.findById(ctx, id).lean();
    if (!document) throw new NotFoundException('A dokumentum nem található');
    return { document, stream: this.bucket.openDownloadStream(new mongo.ObjectId(document.fileId)) };
  }

  /** Small preview image, so the document list never pulls full-size photos. */
  async thumbnail(ctx: TenantContext, id: string) {
    const document = await this.repo.findById(ctx, id).lean();
    if (!document) throw new NotFoundException('A dokumentum nem található');
    if (!document.thumbnailFileId) throw new NotFoundException('Ehhez a dokumentumhoz nincs bélyegkép');
    return {
      mimeType: 'image/webp',
      stream: this.bucket.openDownloadStream(new mongo.ObjectId(document.thumbnailFileId))
    };
  }

  // -------------------------------------------------------------------- OCR

  /**
   * Runs text recognition on a photographed document. The result is cached on
   * the record, so opening it again is instant; `force` re-runs it anyway.
   */
  async recognizeText(ctx: TenantContext, id: string, force = false) {
    const document = await this.repo.findById(ctx, id);
    if (!document) throw new NotFoundException('A dokumentum nem található');
    if (document.kind !== 'image') {
      throw new BadRequestException('Szövegfelismerés csak képekhez érhető el');
    }
    if (!force && document.ocrStatus === 'done' && document.ocrText) {
      return { status: 'done' as const, text: document.ocrText, cached: true, ocrAt: document.ocrAt };
    }

    await this.repo.updateById(ctx, id, { ocrStatus: 'processing', ocrError: undefined });

    try {
      const buffer = await this.readFile(document.fileId);
      const text = await this.ocr.recognize(buffer);
      const ocrAt = new Date();
      await this.repo.updateById(ctx, id, {
        ocrStatus: 'done',
        ocrText: text,
        ocrError: undefined,
        ocrAt
      });
      return { status: 'done' as const, text, cached: false, ocrAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OCR failed for document ${id}: ${message}`);
      await this.repo.updateById(ctx, id, { ocrStatus: 'failed', ocrError: message });
      throw new BadRequestException(`A szövegfelismerés nem sikerült: ${message}`);
    }
  }

  async storedText(ctx: TenantContext, id: string) {
    const document = await this.repo.findById(ctx, id).lean();
    if (!document) throw new NotFoundException('A dokumentum nem található');
    return { status: document.ocrStatus, text: document.ocrText ?? '', ocrAt: document.ocrAt };
  }

  // --------------------------------------------------------------- internals

  private async storeFile(
    ctx: TenantContext,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<string> {
    const upload = this.bucket.openUploadStream(fileName, {
      metadata: { tenantId: ctx.tenantId, uploadedBy: ctx.userId, mimeType }
    });

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer).pipe(upload).on('error', reject).on('finish', () => resolve());
    });

    return String(upload.id);
  }

  private async readFile(fileId: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = this.bucket.openDownloadStream(new mongo.ObjectId(fileId));
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  private async deleteStoredFile(fileId: string) {
    try {
      await this.bucket.delete(new mongo.ObjectId(fileId));
    } catch (error) {
      // The metadata is already gone; a missing blob must not fail the request.
      this.logger.warn(`Could not delete stored file ${fileId}: ${String(error)}`);
    }
  }

  /** Maps `undefined`/`root` to the workspace root and validates real folder ids. */
  private async resolveFolderId(ctx: TenantContext, folderId?: string): Promise<string | null> {
    if (!folderId || folderId === ROOT) return null;
    if (!Types.ObjectId.isValid(folderId)) throw new BadRequestException('Érvénytelen mappa');
    const folder = await this.folderRepo.findById(ctx, folderId).lean();
    if (!folder) throw new NotFoundException('A mappa nem található');
    return folderId;
  }

  /** Ids of a folder and everything nested below it. */
  private async subtreeIds(ctx: TenantContext, rootId: string): Promise<string[]> {
    const folders = await this.folderRepo.find(ctx).select('parentId').lean();
    const childrenOf = new Map<string, string[]>();
    for (const folder of folders) {
      const parent = folder.parentId ?? ROOT;
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), String(folder._id)]);
    }

    const collected: string[] = [];
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      collected.push(current);
      stack.push(...(childrenOf.get(current) ?? []));
    }
    return collected;
  }

  private async isDescendant(ctx: TenantContext, folderId: string, candidateId: string) {
    const ids = await this.subtreeIds(ctx, folderId);
    return ids.includes(candidateId);
  }

  private async resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter((id) => id && Types.ObjectId.isValid(id)))];
    if (unique.length === 0) return new Map();
    const users = await this.users
      .find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
      .select('username email')
      .lean();
    return new Map(users.map((user) => [String(user._id), user.username || user.email]));
  }

  private asFolderConflict(error: unknown, name: string) {
    if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
      return new ConflictException(`Már van "${name}" nevű mappa ezen a szinten`);
    }
    return error;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Multer decodes multipart filenames as latin1, which mangles accented names. */
function decodeFileName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  // Only trust the re-decode when it produced valid UTF-8.
  return decoded.includes('�') ? name : decoded;
}

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return normalizeTags(raw.split(','));
}

function normalizeTags(tags: string[]): string[] {
  const cleaned = tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0 && tag.length <= 40);
  return [...new Set(cleaned)].slice(0, 20);
}

/** Keeps the visible name in step with the format we actually stored. */
function renameToExtension(name: string, extension: string): string {
  if (!extension) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${extension}`;
}

/** Drops the fields Mongo owns so a lean document can seed a new one. */
function stripMeta(document: Record<string, unknown>) {
  const { _id, __v, createdAt, updatedAt, ...rest } = document;
  void _id;
  void __v;
  void createdAt;
  void updatedAt;
  return rest;
}
