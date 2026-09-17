import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ImageProcessor } from './image.service';
import { OcrService } from './ocr.service';
import { DocumentFolder, DocumentFolderSchema } from './schemas/document-folder.schema';
import { StoredDocument, StoredDocumentSchema } from './schemas/document.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoredDocument.name, schema: StoredDocumentSchema },
      { name: DocumentFolder.name, schema: DocumentFolderSchema },
      { name: User.name, schema: UserSchema }
    ]),
    AuditLogModule
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, OcrService, ImageProcessor],
  exports: [DocumentsService, MongooseModule]
})
export class DocumentsModule {}
