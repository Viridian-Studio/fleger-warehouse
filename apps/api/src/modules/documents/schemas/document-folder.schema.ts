import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentFolderDocument = HydratedDocument<DocumentFolder>;

@Schema({ timestamps: true, collection: 'documentfolders' })
export class DocumentFolder {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  /** Null means a top level folder. */
  @Prop({ type: String, default: null })
  parentId?: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;
}

export const DocumentFolderSchema = SchemaFactory.createForClass(DocumentFolder);
DocumentFolderSchema.index({ tenantId: 1, parentId: 1, name: 1 }, { unique: true });
