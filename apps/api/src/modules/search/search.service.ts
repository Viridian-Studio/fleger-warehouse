import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';

export interface SearchResult {
  id: string;
  type: 'inventory' | 'employee' | 'vehicle';
  label: string;
  subtitle: string;
  route: string;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventory: Model<InventoryItem>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>
  ) {}

  async search(ctx: TenantContext, query: string, limit = 10): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const tenantId = ctx.tenantId;
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const perType = Math.ceil(limit / 3);

    const [items, employees, vehicles] = await Promise.all([
      this.inventory
        .find({ tenantId, $or: [{ name: regex }, { inventoryNumber: regex }, { serialNumber: regex }] })
        .limit(perType)
        .lean(),
      this.employees
        .find({
          tenantId,
          $or: [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
            { employeeNumber: regex }
          ]
        })
        .limit(perType)
        .lean(),
      this.vehicles
        .find({
          tenantId,
          $or: [
            { licensePlate: regex },
            { manufacturer: regex },
            { model: regex },
            { vin: regex }
          ]
        })
        .limit(perType)
        .lean()
    ]);

    const results: SearchResult[] = [];

    for (const item of items) {
      results.push({
        id: `inv-${item._id}`,
        type: 'inventory',
        label: item.name,
        subtitle: item.inventoryNumber,
        route: '/inventory'
      });
    }

    for (const emp of employees) {
      results.push({
        id: `emp-${emp._id}`,
        type: 'employee',
        label: `${emp.firstName} ${emp.lastName}`,
        subtitle: emp.employeeNumber,
        route: '/employees'
      });
    }

    for (const v of vehicles) {
      results.push({
        id: `veh-${v._id}`,
        type: 'vehicle',
        label: `${v.manufacturer} ${v.model}`,
        subtitle: v.licensePlate,
        route: '/vehicles'
      });
    }

    return results;
  }
}
