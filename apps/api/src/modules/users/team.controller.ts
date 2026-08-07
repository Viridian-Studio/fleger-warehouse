import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { TenantMembership } from '../tenants/schemas/membership.schema';
import { Role } from '../roles/schemas/role.schema';
import { User } from './schemas/user.schema';

class InviteTeamMemberDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

@ApiTags('team')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'team', version: '1' })
export class TeamController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(TenantMembership.name) private readonly memberships: Model<TenantMembership>,
    @InjectModel(Role.name) private readonly roles: Model<Role>
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
      user: users.find((user) => String(user._id) === String(membership.userId))
    }));
  }

  @RequirePermissions('user.invite')
  @Post('invitations')
  async invite(@Req() request: { tenantContext: TenantContext }, @Body() dto: InviteTeamMemberDto) {
    const role = await this.roles.findOne({ _id: dto.roleId, tenantId: request.tenantContext.tenantId });
    const passwordHash = await bcrypt.hash(dto.password ?? 'Temp12345!', 12);
    const user = await this.users.findOneAndUpdate(
      { email: dto.email.toLowerCase() },
      {
        $setOnInsert: {
          username: dto.username.toLowerCase(),
          email: dto.email.toLowerCase(),
          passwordHash,
          globalStatus: 'ACTIVE',
          platformAdmin: false
        }
      },
      { upsert: true, new: true }
    );

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

    return {
      membership,
      inviteLink: `/accept-invite?tenant=${request.tenantContext.tenantSlug}&email=${encodeURIComponent(user.email)}`
    };
  }
}

function tenantId(value: string) {
  return new Types.ObjectId(value);
}
