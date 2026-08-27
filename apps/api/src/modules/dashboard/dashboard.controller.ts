import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('inventory.read', 'employee.read', 'vehicle.read')
  @Get()
  summary(@Req() request: { tenantContext: TenantContext }) {
    return this.dashboard.summary(request.tenantContext);
  }

  @RequirePermissions('inventory.read', 'vehicle.read')
  @Get('attention')
  attention(@Req() request: { tenantContext: TenantContext }) {
    return this.dashboard.attention(request.tenantContext);
  }

  @RequirePermissions('vehicle.read')
  @Get('upcoming')
  upcoming(@Req() request: { tenantContext: TenantContext }) {
    return this.dashboard.upcoming(request.tenantContext);
  }

  @RequirePermissions('audit.read')
  @Get('activity')
  activity(@Req() request: { tenantContext: TenantContext }, @Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.dashboard.activity(request.tenantContext, Number.isFinite(parsed) ? parsed : undefined);
  }

  @RequirePermissions('inventory.read')
  @Get('movement')
  movement(@Req() request: { tenantContext: TenantContext }, @Query('days') days?: string) {
    const parsed = days ? Number.parseInt(days, 10) : undefined;
    return this.dashboard.movement(request.tenantContext, Number.isFinite(parsed) ? parsed : undefined);
  }
}
