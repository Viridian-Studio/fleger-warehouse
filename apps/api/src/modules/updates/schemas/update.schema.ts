import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UpdateDocument = HydratedDocument<Update>;

@Schema({ timestamps: true })
export class Update {
  @Prop({ type: String, required: true })
  buildName!: string;

  @Prop({ type: String, required: true })
  version!: string;

  @Prop({ type: Number, required: true })
  buildNumber!: number;

  @Prop({ type: Date, required: true })
  releasedAt!: Date;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'UpdateChange' }],
    default: []
  })
  changes!: Types.ObjectId[];
}

export const UpdateSchema = SchemaFactory.createForClass(Update);
UpdateSchema.index({ buildNumber: -1 });
