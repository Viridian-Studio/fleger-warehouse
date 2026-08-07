import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VehicleDocument = HydratedDocument<Vehicle>;

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  licensePlate!: string;

  @Prop({ type: String, required: true })
  manufacturer!: string;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: Number })
  year?: number;

  @Prop({ type: String })
  vin?: string;

  @Prop({ type: Number, default: 0 })
  currentMileage!: number;

  @Prop({ type: String, enum: ['AVAILABLE', 'ASSIGNED', 'SERVICE', 'INACTIVE'], default: 'AVAILABLE' })
  status!: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: String })
  notes?: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ tenantId: 1, licensePlate: 1 }, { unique: true });
