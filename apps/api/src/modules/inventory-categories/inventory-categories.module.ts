import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryCategoriesService } from './inventory-categories.service';
import { InventoryCategory, InventoryCategorySchema } from './schemas/inventory-category.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: InventoryCategory.name, schema: InventoryCategorySchema }])],
  controllers: [InventoryCategoriesController],
  providers: [InventoryCategoriesService],
  exports: [InventoryCategoriesService]
})
export class InventoryCategoriesModule {}
