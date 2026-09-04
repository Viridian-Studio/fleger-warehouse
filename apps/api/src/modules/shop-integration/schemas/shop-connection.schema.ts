import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShopConnectionDocument = HydratedDocument<ShopConnection>;

/**
 * One active API key per tenant, used by an external shop (e.g. a Viridian
 * Commerce store) to authenticate against the shop-facing endpoints
 * (`/auth/verify`, `/export/*`). Generating a new key overwrites the
 * existing one for the tenant — only one shop can be connected at a time.
 */
@Schema({ timestamps: true })
export class ShopConnection {
  @Prop({ type: String, required: true, unique: true, index: true })
  tenantId!: string;

  @Prop({ type: String, required: true })
  keyHash!: string;

  @Prop({ type: String, required: true })
  keyPrefix!: string;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Boolean, default: false })
  revoked!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShopConnectionSchema = SchemaFactory.createForClass(ShopConnection);
