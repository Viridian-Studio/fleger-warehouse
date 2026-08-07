import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { Tenant } from './schemas/tenant.schema';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(@InjectModel(Tenant.name) private readonly tenants: Model<Tenant>) {}

  @Get('workspaces')
  workspaces(@Req() request: { user: { memberships: unknown[] } }) {
    return request.user.memberships;
  }

  @UseGuards(TenantGuard)
  @Get('current')
  current(@Req() request: { tenantContext: TenantContext }) {
    return this.tenants.findById(request.tenantContext.tenantId).select('-__v');
  }

  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions('settings.manage')
  @Patch('settings')
  updateSettings(@Req() request: { tenantContext: TenantContext }, @Body() body: Record<string, unknown>) {
    return this.tenants.findByIdAndUpdate(
      request.tenantContext.tenantId,
      { $set: { settings: body } },
      { new: true }
    ).select('-__v');
  }
}
