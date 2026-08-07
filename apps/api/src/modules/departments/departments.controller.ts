import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @RequirePermissions('employee.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.departments.list(request.tenantContext);
  }

  @RequirePermissions('employee.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(request.tenantContext, dto);
  }

  @RequirePermissions('employee.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.departments.detail(request.tenantContext, id);
  }

  @RequirePermissions('employee.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>) {
    return this.departments.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('employee.update')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.departments.remove(request.tenantContext, id);
  }
}
