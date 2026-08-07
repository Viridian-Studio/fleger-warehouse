import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryItem } from './schemas/inventory-item.schema';
import { InventoryTransaction } from './schemas/inventory-transaction.schema';

@Injectable()
export class InventoryService {
  private readonly repo: TenantScopedRepository<InventoryItem>;

  constructor(
    @InjectModel(InventoryItem.name) private readonly items: Model<InventoryItem>,
    @InjectModel(InventoryTransaction.name) private readonly transactions: Model<InventoryTransaction>
  ) {
    this.repo = new TenantScopedRepository(items);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ name: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  async create(ctx: TenantContext, dto: CreateInventoryItemDto) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.repo.create(ctx, {
          ...dto,
          inventoryNumber: dto.inventoryNumber || (await this.nextInventoryNumber(ctx)),
          availableQuantity: dto.quantity,
          unit: dto.unit ?? 'db',
          status: 'AVAILABLE'
        } as Omit<InventoryItem, 'tenantId'>);
      } catch (error) {
        if (!this.isDuplicateKeyError(error) || dto.inventoryNumber) throw error;
      }
    }

    throw new BadRequestException('Could not generate a unique inventory number');
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateInventoryItemDto>) {
    const { quantity: _quantity, inventoryNumber: _inventoryNumber, ...safeUpdate } = dto;
    return this.repo.updateById(ctx, id, safeUpdate);
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }

  transactionsForTenant(ctx: TenantContext) {
    return this.transactions.find({ tenantId: ctx.tenantId }).sort({ timestamp: -1 }).limit(100);
  }

  async reserve(ctx: TenantContext, itemId: string, quantity: number, target: { employeeId?: string; vehicleId?: string }) {
    const item = await this.repo.findById(ctx, itemId);
    if (!item) throw new NotFoundException('Inventory item not found');
    if (item.availableQuantity < quantity) throw new BadRequestException('Not enough available inventory');
    if (item.type === 'ASSET' && quantity !== 1) throw new BadRequestException('Assets can only be assigned one at a time');

    const previousQuantity = item.availableQuantity;
    item.availableQuantity -= quantity;
    item.status = item.availableQuantity === 0 ? 'ASSIGNED' : item.status;
    await item.save();

    await this.transactions.create({
      tenantId: ctx.tenantId,
      itemId,
      type: 'ASSIGN',
      quantity,
      previousQuantity,
      newQuantity: item.availableQuantity,
      userId: ctx.userId,
      timestamp: new Date(),
      ...target
    });

    return item;
  }

  async adjust(ctx: TenantContext, itemId: string, quantity: number, notes?: string) {
    const item = await this.repo.findById(ctx, itemId);
    if (!item) throw new NotFoundException('Inventory item not found');
    if (item.type === 'ASSET' && quantity > 1) throw new BadRequestException('Assets can only have quantity 0 or 1');

    const assignedQuantity = item.quantity - item.availableQuantity;
    if (quantity < assignedQuantity) {
      throw new BadRequestException('New quantity cannot be lower than currently assigned quantity');
    }

    const previousQuantity = item.availableQuantity;
    item.quantity = quantity;
    item.availableQuantity = quantity - assignedQuantity;
    item.status = item.availableQuantity === 0 ? 'ASSIGNED' : 'AVAILABLE';
    await item.save();

    await this.transactions.create({
      tenantId: ctx.tenantId,
      itemId,
      type: 'ADJUSTMENT',
      quantity,
      previousQuantity,
      newQuantity: item.availableQuantity,
      userId: ctx.userId,
      timestamp: new Date(),
      notes
    });

    return item;
  }

  async release(ctx: TenantContext, itemId: string, quantity: number, target: { employeeId?: string; vehicleId?: string }) {
    const item = await this.repo.findById(ctx, itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    const previousQuantity = item.availableQuantity;
    item.availableQuantity = Math.min(item.quantity, item.availableQuantity + quantity);
    if (item.availableQuantity > 0 && item.status === 'ASSIGNED') {
      item.status = 'AVAILABLE';
    }
    await item.save();

    await this.transactions.create({
      tenantId: ctx.tenantId,
      itemId,
      type: 'RETURN',
      quantity,
      previousQuantity,
      newQuantity: item.availableQuantity,
      userId: ctx.userId,
      timestamp: new Date(),
      ...target
    });

    return item;
  }

  private async nextInventoryNumber(ctx: TenantContext) {
    const items = await this.items
      .find({ tenantId: ctx.tenantId, inventoryNumber: /^INV-\d+$/ })
      .select({ inventoryNumber: 1 })
      .lean();
    const next = items.reduce((max, item) => {
      const match = item.inventoryNumber?.match(/^INV-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

    return `INV-${String(next).padStart(6, '0')}`;
  }

  private isDuplicateKeyError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
