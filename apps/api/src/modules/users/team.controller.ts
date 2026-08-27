import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { TenantMembership } from '../tenants/schemas/membership.schema';
import { Role } from '../roles/schemas/role.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { User } from './schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

class InviteTeamMemberDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

class UpdateMemberDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INVITED', 'DISABLED'])
  status?: string;
}

@ApiTags('team')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'team', version: '1' })
export class TeamController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(TenantMembership.name) private readonly memberships: Model<TenantMembership>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    private readonly notifications: NotificationsService
  ) {}

  @RequirePermissions('user.read')
  @Get()
  async list(@Req() request: { tenantContext: TenantContext }) {
    const tenantId = new Types.ObjectId(request.tenantContext.tenantId);
    const memberships = await this.memberships
      .find({ tenantId })
      .sort({ tenantSlug: 1 });
    const users = await this.users.find({ _id: { $in: memberships.map((item) => item.userId) } }).select('-passwordHash -__v');

    return memberships.map((membership) => ({
      membershipId: String(membership._id),
      status: membership.status,
      permissions: membership.permissions,
      roleId: String(membership.roleId),
      user: users.find((user) => String(user._id) === String(membership.userId))
    }));
  }

  @RequirePermissions('user.invite')
  @Post('invitations')
  async invite(@Req() request: { tenantContext: TenantContext }, @Body() dto: InviteTeamMemberDto) {
    const role = await this.roles.findOne({ _id: dto.roleId, tenantId: request.tenantContext.tenantId });
    const tempPassword = dto.password ?? generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // If employeeId provided, derive username/email from the employee record
    let employeeId: Types.ObjectId | null = null;
    let username = dto.username;
    let email = dto.email;

    if (dto.employeeId) {
      const employee = await this.employees
        .findById(dto.employeeId)
        .where('tenantId')
        .equals(request.tenantContext.tenantId)
        .lean();
      if (!employee) throw new NotFoundException('Employee not found');
      employeeId = new Types.ObjectId(dto.employeeId);
      // Use employee email if available, otherwise generate from name
      if (employee.email) {
        email = employee.email;
      }
      // Default username from first+last name if not provided
      if (!username) {
        username = `${employee.firstName}.${employee.lastName}`.toLowerCase().replace(/\s+/g, '');
      }
    }

    if (!username || !email) {
      throw new NotFoundException('Username and email are required (or provide an employee to link)');
    }

    const user = await this.users.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        $setOnInsert: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          passwordHash,
          passwordMustChange: true,
          globalStatus: 'ACTIVE',
          platformAdmin: false,
          ...(employeeId ? { employeeId } : {})
        }
      },
      { upsert: true, new: true }
    );

    // Link employee to user if employeeId was provided and user didn't have one
    if (employeeId && !user.employeeId) {
      await this.users.updateOne({ _id: user._id }, { $set: { employeeId } });
    }

    const membership = await this.memberships.findOneAndUpdate(
      { userId: user._id, tenantId: tenantId(request.tenantContext.tenantId) },
      {
        $setOnInsert: {
          userId: user._id,
          tenantId: tenantId(request.tenantContext.tenantId),
          tenantSlug: request.tenantContext.tenantSlug,
          roleId: dto.roleId,
          permissions: role?.permissions ?? [],
          status: 'INVITED'
        }
      },
      { upsert: true, new: true }
    );

    await this.notifications.create({
      tenantId: request.tenantContext.tenantId,
      userId: String(user._id),
      type: 'auth.password_change_required',
      title: 'Password change required',
      message: 'Please change your temporary password after first login.',
      link: '/settings'
    });

    return {
      membership,
      tempPassword,
      username: user.username,
      inviteLink: `/accept-invite?tenant=${request.tenantContext.tenantSlug}&email=${encodeURIComponent(user.email)}`
    };
  }

  @RequirePermissions('user.invite')
  @Patch(':membershipId')
  async updateMember(
    @Req() request: { tenantContext: TenantContext },
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto
  ) {
    const membership = await this.memberships.findOne({
      _id: new Types.ObjectId(membershipId),
      tenantId: new Types.ObjectId(request.tenantContext.tenantId)
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const userId = membership.userId;

    // Update user fields if provided
    if (dto.username || dto.email) {
      const userUpdate: Record<string, string> = {};
      if (dto.username) userUpdate.username = dto.username.toLowerCase();
      if (dto.email) userUpdate.email = dto.email.toLowerCase();
      await this.users.updateOne({ _id: userId }, { $set: userUpdate });
    }

    // Update role / permissions if roleId provided
    if (dto.roleId) {
      const role = await this.roles
        .findById(dto.roleId)
        .where('tenantId')
        .equals(request.tenantContext.tenantId)
        .lean();
      if (role) {
        membership.roleId = new Types.ObjectId(dto.roleId);
        membership.permissions = role.permissions;
      }
    }

    // Update status if provided
    if (dto.status) {
      membership.status = dto.status;
    }

    await membership.save();

    return {
      membershipId: String(membership._id),
      status: membership.status,
      permissions: membership.permissions,
      roleId: String(membership.roleId)
    };
  }

  @RequirePermissions('user.invite')
  @Delete(':membershipId')
  async removeMember(
    @Req() request: { tenantContext: TenantContext },
    @Param('membershipId') membershipId: string
  ) {
    const membership = await this.memberships.findOneAndDelete({
      _id: new Types.ObjectId(membershipId),
      tenantId: new Types.ObjectId(request.tenantContext.tenantId)
    });
    if (!membership) throw new NotFoundException('Membership not found');

    // Check if the user has any other memberships; if not, disable the user
    const remaining = await this.memberships.countDocuments({ userId: membership.userId });
    if (remaining === 0) {
      await this.users.updateOne({ _id: membership.userId }, { $set: { globalStatus: 'DISABLED' } });
    }

    return { success: true };
  }
}

function tenantId(value: string) {
  return new Types.ObjectId(value);
}

function generateTempPassword(length = 12): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = lower + upper + digits + special;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  // Ensure at least one of each category
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = chars.length; i < length; i++) chars.push(pick(all));
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
