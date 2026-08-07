import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { Assignment } from '../assignments/schemas/assignment.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(InventoryItem.name) private readonly items: Model<InventoryItem>,
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>,
    @InjectModel(Assignment.name) private readonly assignments: Model<Assignment>
  ) {}

  async summary(ctx: TenantContext) {
    const tenantId = ctx.tenantId;
    const [inventoryItems, lowStock, activeEmployees, activeVehicles, assignedVehicles, assignedAssets] =
      await Promise.all([
        this.items.countDocuments({ tenantId }),
        this.items.countDocuments({ tenantId, type: 'QUANTITY', availableQuantity: { $lte: 5 } }),
        this.employees.countDocuments({ tenantId, active: true }),
        this.vehicles.countDocuments({ tenantId, active: true }),
        this.vehicles.countDocuments({ tenantId, status: 'ASSIGNED' }),
        this.assignments.countDocuments({ tenantId, status: 'ACTIVE' })
      ]);

    return { inventoryItems, lowStock, activeEmployees, activeVehicles, assignedVehicles, assignedAssets };
  }
}
