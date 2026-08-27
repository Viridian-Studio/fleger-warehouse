import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateVehicleFuelLogDto } from './dto/create-vehicle-fuel-log.dto';
import { VehicleFuelLog } from './schemas/vehicle-fuel-log.schema';

export interface FuelConsumptionResult {
  vehicleId: string;
  totalLiters: number;
  distanceKm: number;
  averageConsumptionPer100Km: number | null;
  entries: { _id: string; date: Date; mileage: number; liters: number; consumptionPer100Km: number | null }[];
}

@Injectable()
export class VehicleFuelLogsService {
  private readonly repo: TenantScopedRepository<VehicleFuelLog>;

  constructor(@InjectModel(VehicleFuelLog.name) logs: Model<VehicleFuelLog>) {
    this.repo = new TenantScopedRepository(logs);
  }

  list(ctx: TenantContext, vehicleId?: string) {
    const filter = vehicleId ? { vehicleId } : {};
    return this.repo.find(ctx, filter).sort({ date: -1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  create(ctx: TenantContext, dto: CreateVehicleFuelLogDto) {
    return this.repo.create(ctx, {
      ...dto,
      date: new Date(dto.date),
      cost: dto.cost ?? 0
    } as Omit<VehicleFuelLog, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateVehicleFuelLogDto>) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.date) update.date = new Date(dto.date);
    return this.repo.updateById(ctx, id, update);
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }

  async consumption(ctx: TenantContext, vehicleId: string): Promise<FuelConsumptionResult> {
    const logs = await this.repo.find(ctx, { vehicleId }).sort({ mileage: 1 }).lean();
    const entries: FuelConsumptionResult['entries'] = [];
    let totalLiters = 0;
    let previousMileage = 0;

    for (let i = 0; i < logs.length; i += 1) {
      const log = logs[i];
      const distance = previousMileage > 0 ? log.mileage - previousMileage : 0;
      const consumption = distance > 0 ? (log.liters / distance) * 100 : null;
      entries.push({
        _id: String((log as any)._id),
        date: log.date,
        mileage: log.mileage,
        liters: log.liters,
        consumptionPer100Km: consumption
      });
      totalLiters += log.liters;
      previousMileage = log.mileage;
    }

    const distanceKm = logs.length > 1 ? logs[logs.length - 1].mileage - logs[0].mileage : 0;
    const averageConsumptionPer100Km = distanceKm > 0 ? (totalLiters / distanceKm) * 100 : null;

    return { vehicleId, totalLiters, distanceKm, averageConsumptionPer100Km, entries };
  }
}
