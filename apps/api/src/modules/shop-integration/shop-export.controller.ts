import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Model } from 'mongoose';
import { InventoryCategory, InventoryCategoryDocument } from '../inventory-categories/schemas/inventory-category.schema';
import { InventoryItem, InventoryItemDocument } from '../inventory/schemas/inventory-item.schema';
import { TenantContext } from '../../common/tenant/tenant-context';
import { ApiKeyGuard } from './api-key.guard';

export interface ShopExportInventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  quantity: number;
  availableQuantity: number;
  unit: string;
}

/**
 * Read-only export of warehouse data for a connected shop to browse and
 * select what to bring over. API-key authenticated (no user session).
 */
@ApiTags('shop-integration')
@ApiSecurity('shop-api-key')
@UseGuards(ApiKeyGuard)
@Controller({ path: 'export', version: '1' })
export class ShopExportController {
  constructor(
    @InjectModel(InventoryItem.name) private readonly items: Model<InventoryItemDocument>,
    @InjectModel(InventoryCategory.name) private readonly categories: Model<InventoryCategoryDocument>
  ) {}

  @Get('inventory')
  async inventory(@Req() request: { tenantContext: TenantContext }): Promise<ShopExportInventoryItem[]> {
    const tenantId = request.tenantContext.tenantId;
    const [items, categories] = await Promise.all([
      this.items.find({ tenantId, status: { $ne: 'SCRAPPED' } }).sort({ name: 1 }).lean().exec(),
      this.categories.find({ tenantId }).lean().exec()
    ]);
    const categoryNames = new Map(categories.map((category) => [String(category._id), category.name]));

    return items.map((item) => ({
      id: String(item._id),
      name: item.name,
      sku: item.inventoryNumber,
      category: item.categoryId ? (categoryNames.get(item.categoryId) ?? null) : null,
      quantity: item.quantity,
      availableQuantity: item.availableQuantity,
      unit: item.unit
    }));
  }
}
