import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TenantMembershipDocument = HydratedDocument<TenantMembership>;

@Schema({ timestamps: true })
export class TenantMembership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  tenantSlug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  roleId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ type: String, enum: ['ACTIVE', 'INVITED', 'DISABLED'], default: 'ACTIVE' })
  status!: string;
}

export const TenantMembershipSchema = SchemaFactory.createForClass(TenantMembership);
TenantMembershipSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
