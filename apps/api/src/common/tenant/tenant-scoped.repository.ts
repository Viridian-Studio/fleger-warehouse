import { Model } from 'mongoose';
import { TenantContext } from './tenant-context';

export class TenantScopedRepository<T extends { tenantId: string }> {
  constructor(private readonly model: Model<T>) {}

  find(ctx: TenantContext, filter: Record<string, unknown> = {}) {
    return this.model.find({ ...filter, tenantId: ctx.tenantId });
  }

  findOne(ctx: TenantContext, filter: Record<string, unknown>) {
    return this.model.findOne({ ...filter, tenantId: ctx.tenantId });
  }

  findById(ctx: TenantContext, id: string) {
    return this.model.findOne({ _id: id, tenantId: ctx.tenantId });
  }

  create(ctx: TenantContext, data: Omit<T, 'tenantId'>) {
    return this.model.create({ ...data, tenantId: ctx.tenantId } as T);
  }

  updateById(ctx: TenantContext, id: string, update: Record<string, unknown>) {
    return this.model.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId },
      update,
      { new: true }
    );
  }

  deleteById(ctx: TenantContext, id: string) {
    return this.model.findOneAndDelete({ _id: id, tenantId: ctx.tenantId });
  }
}
