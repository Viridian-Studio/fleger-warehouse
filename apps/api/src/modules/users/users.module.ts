import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantMembership, TenantMembershipSchema } from '../tenants/schemas/membership.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { TeamController } from './team.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TenantMembership.name, schema: TenantMembershipSchema },
      { name: Role.name, schema: RoleSchema }
    ])
  ],
  controllers: [TeamController],
  exports: [MongooseModule]
})
export class UsersModule {}
