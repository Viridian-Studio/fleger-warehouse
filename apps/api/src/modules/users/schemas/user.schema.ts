import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, sparse: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: Boolean, default: false })
  passwordMustChange!: boolean;

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' })
  globalStatus!: string;

  @Prop({ type: Boolean, default: false })
  platformAdmin!: boolean;

  @Prop({ type: Boolean, default: false })
  superAdmin!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  employeeId?: Types.ObjectId | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
