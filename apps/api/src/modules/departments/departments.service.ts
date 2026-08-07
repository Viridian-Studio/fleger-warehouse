import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { Department } from './schemas/department.schema';

@Injectable()
export class DepartmentsService {
  private readonly repo: TenantScopedRepository<Department>;

  constructor(@InjectModel(Department.name) departments: Model<Department>) {
    this.repo = new TenantScopedRepository(departments);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ name: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  create(ctx: TenantContext, dto: CreateDepartmentDto) {
    return this.repo.create(ctx, { ...dto, active: dto.active ?? true } as Omit<Department, 'tenantId'>);
  }

  update(ctx: TenantContext, id: string, dto: Partial<CreateDepartmentDto>) {
    return this.repo.updateById(ctx, id, dto);
  }

  async requireActive(ctx: TenantContext, id: string) {
    const department = await this.repo.findById(ctx, id);
    if (!department || department.active === false) throw new NotFoundException('Department not found');
    return department;
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }
}
