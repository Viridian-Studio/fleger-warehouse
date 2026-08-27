import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { Vehicle } from './schemas/vehicle.schema';

@Injectable()
export class VehiclesService {
  private readonly repo: TenantScopedRepository<Vehicle>;

  constructor(@InjectModel(Vehicle.name) vehicles: Model<Vehicle>) {
    this.repo = new TenantScopedRepository(vehicles);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ licensePlate: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  create(ctx: TenantContext, dto: CreateVehicleDto) {
    return this.repo.create(ctx, {
      ...dto,
      currentMileage: dto.currentMileage ?? 0,
      inspectionExpiry: dto.inspectionExpiry ? new Date(dto.inspectionExpiry) : undefined,
      insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
      status: 'AVAILABLE',
      active: true
    } as Omit<Vehicle, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateVehicleDto>) {
    return this.repo.updateById(ctx, id, dto);
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }

  markAssigned(ctx: TenantContext, id: string) {
    return this.repo.updateById(ctx, id, { status: 'ASSIGNED' });
  }

  markAvailable(ctx: TenantContext, id: string, currentMileage?: number) {
    return this.repo.updateById(ctx, id, {
      status: 'AVAILABLE',
      ...(currentMileage !== undefined ? { currentMileage } : {})
    });
  }

  due(ctx: TenantContext) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    return this.repo.find(ctx, {
      $or: [
        { $expr: { $lte: ['$nextServiceMileage', '$currentMileage'] } },
        { inspectionExpiry: { $lte: threshold } },
        { insuranceExpiry: { $lte: threshold } }
      ]
    }).sort({ licensePlate: 1 });
  }
}
