import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'vehicles', version: '1' })
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @RequirePermissions('vehicle.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.vehicles.list(request.tenantContext);
  }

  @RequirePermissions('vehicle.read')
  @Get('due')
  due(@Req() request: { tenantContext: TenantContext }) {
    return this.vehicles.due(request.tenantContext);
  }

  @RequirePermissions('vehicle.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(request.tenantContext, dto);
  }

  @RequirePermissions('vehicle.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.vehicles.detail(request.tenantContext, id);
  }

  @RequirePermissions('vehicle.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateVehicleDto>) {
    return this.vehicles.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('vehicle.update')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.vehicles.remove(request.tenantContext, id);
  }
}
