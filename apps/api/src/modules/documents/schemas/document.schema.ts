import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StoredDocumentDocument = HydratedDocument<StoredDocument>;

export const DOCUMENT_KINDS = ['image', 'pdf', 'word', 'sheet', 'text', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const OCR_STATUSES = ['none', 'processing', 'done', 'failed', 'unsupported'] as const;
export type OcrStatus = (typeof OCR_STATUSES)[number];

@Schema({ timestamps: true, collection: 'documents' })
export class StoredDocument {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  /** Null means the document sits in the workspace root. */
  @Prop({ type: String, default: null })
  folderId?: string | null;

  /** Display name, extension included. Editable by the user. */
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  originalName!: string;

  @Prop({ type: String, required: true })
  mimeType!: string;

  @Prop({ type: String, default: '' })
  extension!: string;

  @Prop({ type: String, enum: DOCUMENT_KINDS, default: 'other' })
  kind!: DocumentKind;

  @Prop({ type: Number, required: true })
  size!: number;

  /** Upload size before image optimisation, when it differed. */
  @Prop({ type: Number })
  originalSize?: number;

  /** GridFS file id (stringified ObjectId) inside the `documentfiles` bucket. */
  @Prop({ type: String, required: true })
  fileId!: string;

  /** GridFS id of the small preview image, for photos and scans. */
  @Prop({ type: String })
  thumbnailFileId?: string;

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;

  /** sha256 of the stored bytes — used to spot duplicate uploads. */
  @Prop({ type: String, default: '' })
  checksum!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: String, required: true })
  uploadedBy!: string;

  @Prop({ type: String, enum: OCR_STATUSES, default: 'none' })
  ocrStatus!: OcrStatus;

  @Prop({ type: String })
  ocrText?: string;

  @Prop({ type: String })
  ocrError?: string;

  @Prop({ type: Date })
  ocrAt?: Date;
}

export const StoredDocumentSchema = SchemaFactory.createForClass(StoredDocument);
StoredDocumentSchema.index({ tenantId: 1, folderId: 1, name: 1 });
StoredDocumentSchema.index({ tenantId: 1, createdAt: -1 });
StoredDocumentSchema.index({ tenantId: 1, tags: 1 });
