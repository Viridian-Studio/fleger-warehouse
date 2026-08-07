import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApplicationDetailsDocument = HydratedDocument<ApplicationDetails>;

@Schema({ timestamps: true })
export class ApplicationDetails {
  @Prop({ type: String, required: true, unique: true, default: 'default' })
  key!: string;

  @Prop({ type: String, required: true })
  version!: string;

  @Prop({ type: String, required: true })
  buildName!: string;

  @Prop({ type: Number, required: true })
  buildNumber!: number;

  @Prop({ type: String, required: true })
  companyName!: string;
}

export const ApplicationDetailsSchema = SchemaFactory.createForClass(ApplicationDetails);
ApplicationDetailsSchema.index({ key: 1 }, { unique: true });
