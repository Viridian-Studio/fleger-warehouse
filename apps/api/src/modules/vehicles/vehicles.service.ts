import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { nextSequentialNumber } from '../../common/tenant/number-generator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { Vehicle } from './schemas/vehicle.schema';

@Injectable()
export class VehiclesService {
  private readonly repo: TenantScopedRepository<Vehicle>;

  constructor(@InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>) {
    this.repo = new TenantScopedRepository(vehicles);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ licensePlate: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  async create(ctx: TenantContext, dto: CreateVehicleDto) {
    const licensePlate = dto.licensePlate || await nextSequentialNumber(this.vehicles, ctx, 'licensePlate', 'VEH');
    return this.repo.create(ctx, {
      ...dto,
      licensePlate,
      currentMileage: dto.currentMileage ?? 0,
      registrationDate: dto.registrationDate ? new Date(dto.registrationDate) : undefined,
      inspectionExpiry: dto.inspectionExpiry ? new Date(dto.inspectionExpiry) : undefined,
      insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
      status: 'AVAILABLE',
      active: true
    } as Omit<Vehicle, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateVehicleDto>) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.registrationDate) update.registrationDate = new Date(dto.registrationDate);
    if (dto.inspectionExpiry) update.inspectionExpiry = new Date(dto.inspectionExpiry);
    if (dto.insuranceExpiry) update.insuranceExpiry = new Date(dto.insuranceExpiry);
    return this.repo.updateById(ctx, id, update);
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
