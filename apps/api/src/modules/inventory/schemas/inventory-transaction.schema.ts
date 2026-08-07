import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InventoryTransactionDocument = HydratedDocument<InventoryTransaction>;

@Schema({ timestamps: false })
export class InventoryTransaction {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  itemId!: string;

  @Prop({ type: String, required: true, enum: ['STOCK_IN', 'STOCK_OUT', 'ASSIGN', 'RETURN', 'ADJUSTMENT', 'LOST', 'SCRAP'] })
  type!: string;

  @Prop({ type: Number, required: true })
  quantity!: number;

  @Prop({ type: Number, required: true })
  previousQuantity!: number;

  @Prop({ type: Number, required: true })
  newQuantity!: number;

  @Prop({ type: String })
  employeeId?: string;

  @Prop({ type: String })
  vehicleId?: string;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  timestamp!: Date;

  @Prop({ type: String })
  notes?: string;
}

export const InventoryTransactionSchema = SchemaFactory.createForClass(InventoryTransaction);
InventoryTransactionSchema.index({ tenantId: 1, timestamp: -1 });
