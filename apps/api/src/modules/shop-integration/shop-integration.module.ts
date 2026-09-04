import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryCategory, InventoryCategorySchema } from '../inventory-categories/schemas/inventory-category.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { ApiKeyGuard } from './api-key.guard';
import { ShopAuthController } from './shop-auth.controller';
import { ShopConnectionsController } from './shop-connections.controller';
import { ShopConnectionsService } from './shop-connections.service';
import { ShopExportController } from './shop-export.controller';
import { ShopConnection, ShopConnectionSchema } from './schemas/shop-connection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopConnection.name, schema: ShopConnectionSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryCategory.name, schema: InventoryCategorySchema }
    ])
  ],
  controllers: [ShopConnectionsController, ShopAuthController, ShopExportController],
  providers: [ShopConnectionsService, ApiKeyGuard]
})
export class ShopIntegrationModule {}
