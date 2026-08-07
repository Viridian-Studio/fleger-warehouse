import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { AdjustInventoryItemDto } from './dto/adjust-inventory-item.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @RequirePermissions('inventory.read')
  @Get('items')
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.inventory.list(request.tenantContext);
  }

  @RequirePermissions('inventory.create')
  @Post('items')
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateInventoryItemDto) {
    return this.inventory.create(request.tenantContext, dto);
  }

  @RequirePermissions('inventory.read')
  @Get('items/:id')
  detail(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.inventory.detail(request.tenantContext, id);
  }

  @RequirePermissions('inventory.update')
  @Patch('items/:id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateInventoryItemDto>) {
    return this.inventory.update(request.tenantContext, id, dto);
  }

  @RequirePermissions('inventory.update')
  @Delete('items/:id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.inventory.remove(request.tenantContext, id);
  }

  @RequirePermissions('inventory.read')
  @Get('transactions')
  transactions(@Req() request: { tenantContext: TenantContext }) {
    return this.inventory.transactionsForTenant(request.tenantContext);
  }

  @RequirePermissions('inventory.update')
  @Post('items/:id/adjust')
  adjust(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: AdjustInventoryItemDto) {
    return this.inventory.adjust(request.tenantContext, id, dto.quantity, dto.notes);
  }
}
