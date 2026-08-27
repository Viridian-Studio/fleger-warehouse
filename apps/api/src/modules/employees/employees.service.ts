import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { nextSequentialNumber } from '../../common/tenant/number-generator';
import { DepartmentsService } from '../departments/departments.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { Employee } from './schemas/employee.schema';

@Injectable()
export class EmployeesService {
  private readonly repo: TenantScopedRepository<Employee>;

  constructor(
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    private readonly departments: DepartmentsService
  ) {
    this.repo = new TenantScopedRepository(employees);
  }

  list(ctx: TenantContext) {
    return this.repo.find(ctx).sort({ lastName: 1, firstName: 1 });
  }

  detail(ctx: TenantContext, id: string) {
    return this.repo.findById(ctx, id);
  }

  async create(ctx: TenantContext, dto: CreateEmployeeDto) {
    const department = dto.departmentId ? await this.departments.requireActive(ctx, dto.departmentId) : null;
    const employeeNumber = dto.employeeNumber || await nextSequentialNumber(this.employees, ctx, 'employeeNumber', 'EMP');
    return this.repo.create(ctx, {
      ...dto,
      employeeNumber,
      department: department?.name ?? dto.department,
      active: dto.active ?? true
    } as Omit<Employee, 'tenantId'>);
  }

  async update(ctx: TenantContext, id: string, dto: Partial<CreateEmployeeDto>) {
    const department = dto.departmentId ? await this.departments.requireActive(ctx, dto.departmentId) : null;
    const shouldClearDepartment = dto.departmentId === '';
    return this.repo.updateById(ctx, id, {
      ...dto,
      ...(department ? { department: department.name } : {}),
      ...(shouldClearDepartment ? { department: '' } : {})
    });
  }

  disable(ctx: TenantContext, id: string) {
    return this.repo.updateById(ctx, id, { active: false });
  }

  reactivate(ctx: TenantContext, id: string) {
    return this.repo.updateById(ctx, id, { active: true });
  }

  remove(ctx: TenantContext, id: string) {
    return this.repo.deleteById(ctx, id);
  }
}
