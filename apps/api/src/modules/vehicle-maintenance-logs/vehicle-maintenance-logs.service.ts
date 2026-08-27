import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateVehicleMaintenanceLogDto } from './dto/create-vehicle-maintenance-log.dto';
import { VehicleMaintenanceLog } from './schemas/vehicle-maintenance-log.schema';

@Injectable()
export class VehicleMaintenanceLogsService {
  private readonly repo: TenantScopedRepository<VehicleMaintenanceLog>;

  constructor(@InjectModel(VehicleMaintenanceLog.name) logs: Model<VehicleMaintenanceLog>) {
    this.repo = new TenantScopedRepository(logs);
  }

  list(ctx: TenantContext, vehicleId?: string) {
    const filter = vehicleId ? { vehicleId } : {};
    return this.repo.find(ctx, filter).sort({ date: -1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  create(ctx: TenantContext, dto: CreateVehicleMaintenanceLogDto) {
    return this.repo.create(ctx, {
      ...dto,
      date: new Date(dto.date),
      cost: dto.cost ?? 0
    } as Omit<VehicleMaintenanceLog, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateVehicleMaintenanceLogDto>) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.date) update.date = new Date(dto.date);
    return this.repo.updateById(ctx, id, update);
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }
}
