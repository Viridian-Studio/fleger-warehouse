import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

@Schema({ timestamps: true })
export class InventoryItem {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  inventoryNumber!: string;

  @Prop({ type: String, required: true, enum: ['QUANTITY', 'ASSET'] })
  type!: 'QUANTITY' | 'ASSET';

  @Prop({ type: String })
  categoryId?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  serialNumber?: string;

  @Prop({ type: Number, required: true, min: 0, default: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0, default: 1 })
  availableQuantity!: number;

  @Prop({ type: Number, default: 5 })
  lowStockThreshold!: number;

  @Prop({ type: String, default: 'db' })
  unit!: string;

  @Prop({ type: String, required: true, enum: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'SCRAPPED'], default: 'AVAILABLE' })
  status!: string;

  @Prop({ type: String })
  location?: string;

  @Prop({ type: String })
  notes?: string;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ tenantId: 1, inventoryNumber: 1 }, { unique: true });
