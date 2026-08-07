import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  slug!: string;

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'], default: 'ACTIVE' })
  status!: string;

  @Prop({ type: String, required: true, default: 'STARTER' })
  planCode!: string;

  @Prop({ type: Object, default: {} })
  settings!: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  branding!: Record<string, unknown>;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
