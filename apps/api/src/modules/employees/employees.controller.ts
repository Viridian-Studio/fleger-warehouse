import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermissions('employee.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.employees.list(request.tenantContext);
  }

  @RequirePermissions('employee.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(request.tenantContext, dto);
  }

  @RequirePermissions('employee.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.employees.detail(request.tenantContext, id);
  }

  @RequirePermissions('employee.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.employees.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('employee.disable')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.employees.remove(request.tenantContext, id);
  }

  @RequirePermissions('employee.disable')
  @Post(':id/disable')
  disable(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.employees.disable(request.tenantContext, id);
  }

  @RequirePermissions('employee.disable')
  @Post(':id/reactivate')
  reactivate(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.employees.reactivate(request.tenantContext, id);
  }
}
