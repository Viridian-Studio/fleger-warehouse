import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { InventoryService } from '../src/modules/inventory/inventory.service';

const ctx = {
  tenantId: 'tenant-a',
  tenantSlug: 'acme',
  userId: 'user-a',
  permissions: [],
  platformAdmin: false
};

describe('InventoryService', () => {
  it('rejects quantity adjustments below assigned quantity', async () => {
    const item = {
      type: 'QUANTITY',
      quantity: 10,
      availableQuantity: 4,
      save: jest.fn()
    };
    const itemsModel = {
      findOne: jest.fn().mockReturnValue(item)
    };
    const service = new InventoryService(itemsModel as never, { create: jest.fn() } as never);

    await expect(service.adjust(ctx, 'item-a', 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records adjustment transactions with the previous and new available quantity', async () => {
    const item = {
      type: 'QUANTITY',
      quantity: 10,
      availableQuantity: 8,
      status: 'AVAILABLE',
      save: jest.fn()
    };
    const transactions = { create: jest.fn() };
    const itemsModel = {
      findOne: jest.fn().mockReturnValue(item)
    };
    const service = new InventoryService(itemsModel as never, transactions as never);

    await service.adjust(ctx, 'item-a', 12, 'cycle count');

    expect(item.quantity).toBe(12);
    expect(item.availableQuantity).toBe(10);
    expect(transactions.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      itemId: 'item-a',
      type: 'ADJUSTMENT',
      previousQuantity: 8,
      newQuantity: 10,
      notes: 'cycle count'
    }));
  });
});
