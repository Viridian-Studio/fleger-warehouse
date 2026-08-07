import { BadRequestException, NotFoundException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { InventoryService } from '../inventory/inventory.service';
import { EmployeesService } from '../employees/employees.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateInventoryAssignmentDto } from './dto/create-inventory-assignment.dto';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { ReturnVehicleAssignmentDto } from './dto/return-vehicle-assignment.dto';
import { Assignment } from './schemas/assignment.schema';
import { VehicleAssignment } from './schemas/vehicle-assignment.schema';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name) private readonly assignments: Model<Assignment>,
    @InjectModel(VehicleAssignment.name) private readonly vehicleAssignments: Model<VehicleAssignment>,
    private readonly inventory: InventoryService,
    private readonly employees: EmployeesService,
    private readonly vehicles: VehiclesService
  ) {}

  list(ctx: TenantContext) {
    return this.assignments.find({ tenantId: ctx.tenantId }).sort({ assignedAt: -1 });
  }

  listVehicleAssignments(ctx: TenantContext) {
    return this.vehicleAssignments.find({ tenantId: ctx.tenantId }).sort({ assignedAt: -1 });
  }

  async assignInventory(ctx: TenantContext, dto: CreateInventoryAssignmentDto) {
    await this.inventory.reserve(ctx, dto.itemId, dto.quantity, {
      employeeId: dto.targetType === 'EMPLOYEE' ? dto.targetId : undefined,
      vehicleId: dto.targetType === 'VEHICLE' ? dto.targetId : undefined
    });

    return this.assignments.create({
      tenantId: ctx.tenantId,
      itemId: dto.itemId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      quantity: dto.quantity,
      assignedAt: new Date(),
      assignedBy: ctx.userId,
      status: 'ACTIVE'
    });
  }

  async returnInventory(ctx: TenantContext, id: string) {
    const assignment = await this.assignments.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId, status: 'ACTIVE' },
      { $set: { status: 'RETURNED', returnedAt: new Date(), returnedBy: ctx.userId } },
      { new: true }
    );

    if (!assignment) throw new NotFoundException('Active assignment not found');

    await this.inventory.release(ctx, assignment.itemId, assignment.quantity, {
      employeeId: assignment.targetType === 'EMPLOYEE' ? assignment.targetId : undefined,
      vehicleId: assignment.targetType === 'VEHICLE' ? assignment.targetId : undefined
    });

    return assignment;
  }

  async assignVehicle(ctx: TenantContext, dto: CreateVehicleAssignmentDto) {
    const [vehicle, employee, activeAssignment] = await Promise.all([
      this.vehicles.detail(ctx, dto.vehicleId),
      this.employees.detail(ctx, dto.employeeId),
      this.vehicleAssignments.findOne({ tenantId: ctx.tenantId, vehicleId: dto.vehicleId, status: 'ACTIVE' })
    ]);

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!employee) throw new NotFoundException('Employee not found');
    if (activeAssignment) throw new BadRequestException('Vehicle already has an active assignment');
    if (vehicle.active === false || vehicle.status === 'INACTIVE') throw new BadRequestException('Vehicle is inactive');
    if (employee.active === false) throw new BadRequestException('Employee is inactive');

    const assignment = await this.vehicleAssignments.create({
      tenantId: ctx.tenantId,
      vehicleId: dto.vehicleId,
      employeeId: dto.employeeId,
      assignedAt: new Date(),
      assignedBy: ctx.userId,
      mileageAtAssignment: dto.mileageAtAssignment,
      status: 'ACTIVE',
      notes: dto.notes
    });

    await this.vehicles.markAssigned(ctx, dto.vehicleId);
    return assignment;
  }

  async returnVehicle(ctx: TenantContext, id: string, dto: ReturnVehicleAssignmentDto) {
    const assignment = await this.vehicleAssignments.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId, status: 'ACTIVE' },
      {
        $set: {
          status: 'RETURNED',
          returnedAt: new Date(),
          returnedBy: ctx.userId,
          ...(dto.mileageAtReturn !== undefined ? { mileageAtReturn: dto.mileageAtReturn } : {}),
          ...(dto.notes ? { notes: dto.notes } : {})
        }
      },
      { new: true }
    );

    if (!assignment) throw new NotFoundException('Active vehicle assignment not found');

    await this.vehicles.markAvailable(ctx, assignment.vehicleId, dto.mileageAtReturn);
    return assignment;
  }
}
