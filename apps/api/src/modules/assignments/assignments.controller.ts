import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { AssignmentsService } from './assignments.service';
import { CreateInventoryAssignmentDto } from './dto/create-inventory-assignment.dto';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { ReturnVehicleAssignmentDto } from './dto/return-vehicle-assignment.dto';

@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'assignments', version: '1' })
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @RequirePermissions('inventory.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.assignments.list(request.tenantContext);
  }

  @RequirePermissions('vehicle.read')
  @Get('vehicles')
  listVehicleAssignments(@Req() request: { tenantContext: TenantContext }) {
    return this.assignments.listVehicleAssignments(request.tenantContext);
  }

  @RequirePermissions('inventory.assign')
  @Post('inventory')
  assignInventory(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateInventoryAssignmentDto) {
    return this.assignments.assignInventory(request.tenantContext, dto);
  }

  @RequirePermissions('inventory.assign')
  @Post('inventory/:id/return')
  returnInventory(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.assignments.returnInventory(request.tenantContext, id);
  }

  @RequirePermissions('vehicle.assign')
  @Post('vehicles')
  assignVehicle(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateVehicleAssignmentDto) {
    return this.assignments.assignVehicle(request.tenantContext, dto);
  }

  @RequirePermissions('vehicle.assign')
  @Post('vehicles/:id/return')
  returnVehicle(
    @Req() request: { tenantContext: TenantContext },
    @Param('id') id: string,
    @Body() dto: ReturnVehicleAssignmentDto
  ) {
    return this.assignments.returnVehicle(request.tenantContext, id, dto);
  }
}
