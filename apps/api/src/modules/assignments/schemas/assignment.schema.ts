import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssignmentDocument = HydratedDocument<Assignment>;

@Schema({ timestamps: true })
export class Assignment {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  itemId!: string;

  @Prop({ type: String, required: true, enum: ['EMPLOYEE', 'VEHICLE'] })
  targetType!: string;

  @Prop({ type: String, required: true })
  targetId!: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Date, required: true })
  assignedAt!: Date;

  @Prop({ type: Date })
  returnedAt?: Date;

  @Prop({ type: String, required: true })
  assignedBy!: string;

  @Prop({ type: String })
  returnedBy?: string;

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'RETURNED'], default: 'ACTIVE' })
  status!: string;

  @Prop({ type: String })
  notes?: string;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
AssignmentSchema.index({ tenantId: 1, itemId: 1, status: 1 });
