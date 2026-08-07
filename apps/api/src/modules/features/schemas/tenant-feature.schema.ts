import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantFeatureDocument = HydratedDocument<TenantFeature>;

@Schema({ timestamps: true })
export class TenantFeature {
  @Prop({ type: String, required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  feature!: string;

  @Prop({ type: Boolean, required: true, default: true })
  enabled!: boolean;
}

export const TenantFeatureSchema = SchemaFactory.createForClass(TenantFeature);
TenantFeatureSchema.index({ tenantId: 1, feature: 1 }, { unique: true });
