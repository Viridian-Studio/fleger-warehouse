import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
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

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });
DepartmentSchema.index({ tenantId: 1, active: 1 });
