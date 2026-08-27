import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VehicleMaintenanceLogDocument = HydratedDocument<VehicleMaintenanceLog>;

@Schema({ timestamps: true })
export class VehicleMaintenanceLog {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true, index: true })
  vehicleId!: string;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Number, required: true, default: 0 })
  mileageAtService!: number;

  @Prop({ type: Number, default: 0 })
  cost!: number;

  @Prop({
    type: String,
    required: true,
    enum: ['oil', 'tire', 'inspection', 'repair', 'other']
  })
  type!: string;

  @Prop({ type: String })
  notes?: string;
}

export const VehicleMaintenanceLogSchema = SchemaFactory.createForClass(VehicleMaintenanceLog);
VehicleMaintenanceLogSchema.index({ tenantId: 1, vehicleId: 1, date: -1 });
