import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { CreateVehicleMaintenanceLogDto } from './dto/create-vehicle-maintenance-log.dto';
import { VehicleMaintenanceLogsService } from './vehicle-maintenance-logs.service';

@ApiTags('vehicle-maintenance-logs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'vehicle-maintenance-logs', version: '1' })
export class VehicleMaintenanceLogsController {
  constructor(private readonly logs: VehicleMaintenanceLogsService) {}

  @RequirePermissions('vehicle.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }, @Query('vehicleId') vehicleId?: string) {
    return this.logs.list(request.tenantContext, vehicleId);
  }

  @RequirePermissions('vehicle.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateVehicleMaintenanceLogDto) {
    return this.logs.create(request.tenantContext, dto);
  }

  @RequirePermissions('vehicle.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.logs.detail(request.tenantContext, id);
  }

  @RequirePermissions('vehicle.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateVehicleMaintenanceLogDto>) {
    return this.logs.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('vehicle.update')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.logs.remove(request.tenantContext, id);
  }
}
