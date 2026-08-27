import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { InventoryCategory } from './schemas/inventory-category.schema';

@Injectable()
export class InventoryCategoriesService {
  private readonly repo: TenantScopedRepository<InventoryCategory>;

  constructor(@InjectModel(InventoryCategory.name) categories: Model<InventoryCategory>) {
    this.repo = new TenantScopedRepository(categories);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ name: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  create(ctx: TenantContext, dto: CreateInventoryCategoryDto) {
    return this.repo.create(ctx, { ...dto, active: dto.active ?? true } as Omit<InventoryCategory, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateInventoryCategoryDto>) {
    return this.repo.updateById(ctx, id, dto);
  }

  async requireActive(ctx: TenantContext, id: string) {
    const category = await this.repo.findById(ctx, id);
    if (!category || category.active === false) throw new NotFoundException('Category not found');
    return category;
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }
}
