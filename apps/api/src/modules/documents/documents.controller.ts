import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { MAX_DOCUMENT_BYTES } from './document-types';
import { DocumentsService, UploadedFile as MulterFile } from './documents.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

type TenantRequest = { tenantContext: TenantContext };

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // Folder routes are declared first so `folders` is never matched as an id.

  @RequirePermissions('document.read')
  @Get('folders')
  listFolders(@Req() request: TenantRequest) {
    return this.documents.listFolders(request.tenantContext);
  }

  @RequirePermissions('document.update')
  @Post('folders')
  createFolder(@Req() request: TenantRequest, @Body() dto: CreateFolderDto) {
    return this.documents.createFolder(request.tenantContext, dto);
  }

  @RequirePermissions('document.update')
  @Patch('folders/:id')
  updateFolder(@Req() request: TenantRequest, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.documents.updateFolder(request.tenantContext, id, dto);
  }

  @RequirePermissions('document.delete')
  @Delete('folders/:id')
  deleteFolder(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.documents.deleteFolder(request.tenantContext, id);
  }

  @RequirePermissions('document.read')
  @Get('tags')
  listTags(@Req() request: TenantRequest) {
    return this.documents.listTags(request.tenantContext);
  }

  @RequirePermissions('document.read')
  @Get()
  list(@Req() request: TenantRequest, @Query() query: ListDocumentsDto) {
    return this.documents.list(request.tenantContext, query);
  }

  @RequirePermissions('document.create')
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: { type: 'string' },
        name: { type: 'string' },
        notes: { type: 'string' },
        tags: { type: 'string', description: 'Comma separated' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  upload(
    @Req() request: TenantRequest,
    @UploadedFile() file: MulterFile | undefined,
    @Body() dto: UploadDocumentDto
  ) {
    return this.documents.upload(request.tenantContext, file, dto);
  }

  @RequirePermissions('document.read')
  @Get(':id')
  detail(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.documents.detail(request.tenantContext, id);
  }

  @RequirePermissions('document.read')
  @Get(':id/content')
  async content(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() response: Response
  ) {
    const { document, stream } = await this.documents.content(request.tenantContext, id);
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';

    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', String(document.size));
    response.setHeader('Cache-Control', 'private, max-age=60');
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(document.name)}`
    );

    stream.on('error', () => {
      if (!response.headersSent) response.status(404);
      response.end();
    });
    stream.pipe(response);
  }

  @RequirePermissions('document.read')
  @Get(':id/thumbnail')
  async thumbnail(@Req() request: TenantRequest, @Param('id') id: string, @Res() response: Response) {
    const { mimeType, stream } = await this.documents.thumbnail(request.tenantContext, id);
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');
    stream.on('error', () => {
      if (!response.headersSent) response.status(404);
      response.end();
    });
    stream.pipe(response);
  }

  @RequirePermissions('document.update')
  @Patch(':id')
  update(@Req() request: TenantRequest, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('document.create')
  @Post(':id/duplicate')
  duplicate(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: { folderId?: string }
  ) {
    return this.documents.duplicate(request.tenantContext, id, body?.folderId);
  }

  @RequirePermissions('document.delete')
  @Delete(':id')
  remove(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.documents.remove(request.tenantContext, id);
  }

  @RequirePermissions('document.read')
  @Get(':id/text')
  storedText(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.documents.storedText(request.tenantContext, id);
  }

  @RequirePermissions('document.read')
  @Post(':id/text')
  recognizeText(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: { force?: boolean }
  ) {
    return this.documents.recognizeText(request.tenantContext, id, body?.force === true);
  }
}
