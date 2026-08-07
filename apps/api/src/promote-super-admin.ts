import 'reflect-metadata';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { UserSchema } from './modules/users/schemas/user.schema';

config({ path: resolve(__dirname, '../.env') });

async function main() {
  const email = process.argv[2]?.toLowerCase() ?? 'jovanovicsp@gmail.com';
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fleger_warehouse');

  const User = mongoose.model('User', UserSchema);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { platformAdmin: true, superAdmin: true, globalStatus: 'ACTIVE' } },
    { returnDocument: 'after' }
  ).select('email username platformAdmin superAdmin globalStatus');

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  console.log(`Super admin enabled for ${user.email}`);
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
