import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VehicleFuelLogDocument = HydratedDocument<VehicleFuelLog>;

@Schema({ timestamps: true })
export class VehicleFuelLog {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true, index: true })
  vehicleId!: string;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Number, required: true })
  mileage!: number;

  @Prop({ type: Number, required: true })
  liters!: number;

  @Prop({ type: Number, default: 0 })
  cost!: number;

  @Prop({ type: String })
  station?: string;

  @Prop({ type: String })
  notes?: string;
}

export const VehicleFuelLogSchema = SchemaFactory.createForClass(VehicleFuelLog);
VehicleFuelLogSchema.index({ tenantId: 1, vehicleId: 1, date: -1 });
