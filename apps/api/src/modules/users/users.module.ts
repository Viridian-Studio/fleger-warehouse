import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantMembership, TenantMembershipSchema } from '../tenants/schemas/membership.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { TeamController } from './team.controller';
import { User, UserSchema } from './schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: TenantMembership.name, schema: TenantMembershipSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Employee.name, schema: EmployeeSchema }
    ]),
    NotificationsModule
  ],
  controllers: [TeamController],
  exports: [MongooseModule]
})
export class UsersModule {}
