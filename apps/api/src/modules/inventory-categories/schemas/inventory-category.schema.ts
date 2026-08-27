import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InventoryCategoryDocument = HydratedDocument<InventoryCategory>;

@Schema({ timestamps: true })
export class InventoryCategory {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  code?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;
}

export const InventoryCategorySchema = SchemaFactory.createForClass(InventoryCategory);
InventoryCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
