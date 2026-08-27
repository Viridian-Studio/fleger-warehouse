import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { InventoryCategoriesService } from './inventory-categories.service';

@ApiTags('inventory-categories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'inventory-categories', version: '1' })
export class InventoryCategoriesController {
  constructor(private readonly categories: InventoryCategoriesService) {}

  @RequirePermissions('inventory.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.categories.list(request.tenantContext);
  }

  @RequirePermissions('inventory.create')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateInventoryCategoryDto) {
    return this.categories.create(request.tenantContext, dto);
  }

  @RequirePermissions('inventory.read')
  @Get(':id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.categories.detail(request.tenantContext, id);
  }

  @RequirePermissions('inventory.update')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateInventoryCategoryDto>) {
    return this.categories.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('inventory.update')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.categories.remove(request.tenantContext, id);
  }
}
