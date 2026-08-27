import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { AuditLog } from './schemas/audit-log.schema';
import { User } from '../users/schemas/user.schema';

@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'audit-log', version: '1' })
export class AuditLogController {
  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogs: Model<AuditLog>,
    @InjectModel(User.name) private readonly users: Model<User>
  ) {}

  @RequirePermissions('audit.read')
  @Get()
  async list(@Req() request: { tenantContext: TenantContext }) {
    const logs = await this.auditLogs
      .find({ tenantId: request.tenantContext.tenantId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const userIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))];
    const users = userIds.length > 0
      ? await this.users.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } }).select('username email').lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u.username || u.email]));

    return logs.map((log) => ({
      ...log,
      actorName: userMap.get(log.actorUserId) ?? log.actorUserId
    }));
  }
}
