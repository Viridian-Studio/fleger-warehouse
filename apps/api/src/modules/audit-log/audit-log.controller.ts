import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { AuditLog } from './schemas/audit-log.schema';

@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'audit-log', version: '1' })
export class AuditLogController {
  constructor(@InjectModel(AuditLog.name) private readonly auditLogs: Model<AuditLog>) {}

  @RequirePermissions('audit.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.auditLogs.find({ tenantId: request.tenantContext.tenantId }).sort({ timestamp: -1 }).limit(100);
  }
}
