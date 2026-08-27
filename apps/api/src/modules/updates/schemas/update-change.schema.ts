import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UpdateChangeDocument = HydratedDocument<UpdateChange>;

@Schema({ timestamps: true })
export class UpdateChange {
  @Prop({ type: String, required: true, index: true })
  updateId!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['feature', 'improvement', 'fix', 'breaking', 'security']
  })
  type!: string;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, default: '' })
  description?: string;
}

export const UpdateChangeSchema = SchemaFactory.createForClass(UpdateChange);
UpdateChangeSchema.index({ updateId: 1, _id: 1 });
