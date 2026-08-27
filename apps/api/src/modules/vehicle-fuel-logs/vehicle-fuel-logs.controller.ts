import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { CreateVehicleFuelLogDto } from './dto/create-vehicle-fuel-log.dto';
import { VehicleFuelLogsService } from './vehicle-fuel-logs.service';

@ApiTags('vehicle-fuel-logs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'vehicle-fuel-logs', version: '1' })
export class VehicleFuelLogsController {
  constructor(private readonly logs: VehicleFuelLogsService) {}

  @RequirePermissions('vehicle.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }, @Query('vehicleId') vehicleId?: string) {
    return this.logs.list(request.tenantContext, vehicleId);
  }

  @RequirePermissions('vehicle.read')
  @Get('consumption')
  consumption(@Req() request: { tenantContext: TenantContext }, @Query('vehicleId') vehicleId: string) {
    if (!vehicleId) throw new BadRequestException('vehicleId is required');
    return this.logs.consumption(request.tenantContext, vehicleId);
  }

  @RequirePermissions('vehicle.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateVehicleFuelLogDto) {
    return this.logs.create(request.tenantContext, dto);
  }

  @RequirePermissions('vehicle.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.logs.detail(request.tenantContext, id);
  }

  @RequirePermissions('vehicle.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateVehicleFuelLogDto>) {
    return this.logs.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('vehicle.update')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.logs.remove(request.tenantContext, id);
  }
}
