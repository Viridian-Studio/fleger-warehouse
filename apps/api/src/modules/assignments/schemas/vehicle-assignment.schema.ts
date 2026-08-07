import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VehicleAssignmentDocument = HydratedDocument<VehicleAssignment>;

@Schema({ timestamps: true })
export class VehicleAssignment {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  vehicleId!: string;

  @Prop({ type: String, required: true })
  employeeId!: string;

  @Prop({ type: Date, required: true })
  assignedAt!: Date;

  @Prop({ type: Date })
  returnedAt?: Date;

  @Prop({ type: Number, required: true })
  mileageAtAssignment!: number;

  @Prop({ type: Number })
  mileageAtReturn?: number;

  @Prop({ type: String, required: true })
  assignedBy!: string;

  @Prop({ type: String })
  returnedBy?: string;

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'RETURNED'], default: 'ACTIVE' })
  status!: string;

  @Prop({ type: String })
  notes?: string;
}

export const VehicleAssignmentSchema = SchemaFactory.createForClass(VehicleAssignment);
VehicleAssignmentSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });
