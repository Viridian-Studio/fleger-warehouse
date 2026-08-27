import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantContext } from '../../common/tenant/tenant-context';
import { Assignment } from '../assignments/schemas/assignment.schema';
import { VehicleAssignment } from '../assignments/schemas/vehicle-assignment.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { InventoryTransaction } from '../inventory/schemas/inventory-transaction.schema';
import { Vehicle } from '../vehicles/schemas/vehicle.schema';
import { AuditLog } from '../audit-log/schemas/audit-log.schema';
import { User } from '../users/schemas/user.schema';

export interface AttentionItem {
  id: string;
  severity: 'critical' | 'warning';
  kind: 'low-stock' | 'vehicle-service' | 'inspection-expired' | 'insurance-expired' | 'inspection-soon' | 'insurance-soon';
  title: string;
  description: string;
  link: string;
  count: number;
}

export interface UpcomingEvent {
  id: string;
  severity: 'critical' | 'warning';
  kind: 'inspection' | 'insurance';
  vehicleId: string;
  vehicleName: string;
  date: string;
  daysUntil: number;
}

export interface ActivityEntry {
  _id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
}

export interface MovementBucket {
  date: string;
  stockIn: number;
  assigned: number;
  returned: number;
}

const SOON_DAYS = 30;
const UPCOMING_DAYS = 60;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(InventoryItem.name) private readonly items: Model<InventoryItem>,
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>,
    @InjectModel(Assignment.name) private readonly assignments: Model<Assignment>,
    @InjectModel(VehicleAssignment.name) private readonly vehicleAssignments: Model<VehicleAssignment>,
    @InjectModel(AuditLog.name) private readonly auditLogs: Model<AuditLog>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(InventoryTransaction.name) private readonly transactions: Model<InventoryTransaction>
  ) {}

  async summary(ctx: TenantContext) {
    const tenantId = ctx.tenantId;
    const [
      inventoryItems,
      lowStock,
      activeEmployees,
      activeVehicles,
      assignedVehicles,
      assignedAssets,
      availableVehicles,
      serviceVehicles,
      availableUnitsAgg
    ] = await Promise.all([
      this.items.countDocuments({ tenantId }),
      this.items.countDocuments({ tenantId, type: 'QUANTITY', $expr: { $lte: ['$availableQuantity', '$lowStockThreshold'] } }),
      this.employees.countDocuments({ tenantId, active: true }),
      this.vehicles.countDocuments({ tenantId, active: true }),
      this.vehicles.countDocuments({ tenantId, status: 'ASSIGNED' }),
      this.assignments.countDocuments({ tenantId, status: 'ACTIVE' }),
      this.vehicles.countDocuments({ tenantId, status: 'AVAILABLE', active: true }),
      this.vehicles.countDocuments({ tenantId, status: 'SERVICE' }),
      this.items.aggregate<{ available: number }>([
        { $match: { tenantId } },
        { $group: { _id: null, available: { $sum: '$availableQuantity' } } }
      ])
    ]);

    const availableUnits = availableUnitsAgg.length > 0 ? availableUnitsAgg[0].available : 0;

    return {
      inventoryItems,
      lowStock,
      activeEmployees,
      activeVehicles,
      assignedVehicles,
      assignedAssets,
      availableVehicles,
      serviceVehicles,
      availableUnits
    };
  }

  async attention(ctx: TenantContext): Promise<AttentionItem[]> {
    const tenantId = ctx.tenantId;
    const items: AttentionItem[] = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const soon = new Date(now);
    soon.setDate(soon.getDate() + SOON_DAYS);

    const [lowStockItems, serviceVehicles, expiredInspection, soonInspection, expiredInsurance, soonInsurance] = await Promise.all([
      this.items
        .find({ tenantId, type: 'QUANTITY', $expr: { $lte: ['$availableQuantity', '$lowStockThreshold'] } })
        .sort({ availableQuantity: 1 })
        .limit(5)
        .lean(),
      this.vehicles.countDocuments({ tenantId, status: 'SERVICE' }),
      this.vehicles.countDocuments({ tenantId, inspectionExpiry: { $lt: now } }),
      this.vehicles.countDocuments({ tenantId, inspectionExpiry: { $gte: now, $lte: soon } }),
      this.vehicles.countDocuments({ tenantId, insuranceExpiry: { $lt: now } }),
      this.vehicles.countDocuments({ tenantId, insuranceExpiry: { $gte: now, $lte: soon } })
    ]);

    if (lowStockItems.length > 0) {
      items.push({
        id: 'low-stock',
        severity: 'warning',
        kind: 'low-stock',
        title: 'Alacsony készlet',
        description: `${lowStockItems.length} készlettétel elérhetősége a minimum alatt`,
        link: '/inventory?filter=low-stock',
        count: lowStockItems.length
      });
    }

    if (serviceVehicles > 0) {
      items.push({
        id: 'vehicle-service',
        severity: 'warning',
        kind: 'vehicle-service',
        title: 'Jármű szervizben',
        description: `${serviceVehicles} jármű jelenleg szerviz alatt áll`,
        link: '/vehicles?filter=service',
        count: serviceVehicles
      });
    }

    if (expiredInspection > 0) {
      items.push({
        id: 'inspection-expired',
        severity: 'critical',
        kind: 'inspection-expired',
        title: 'Lejárt műszaki vizsga',
        description: `${expiredInspection} jármű műszaki vizsgája lejárt`,
        link: '/vehicles?filter=attention',
        count: expiredInspection
      });
    }

    if (expiredInsurance > 0) {
      items.push({
        id: 'insurance-expired',
        severity: 'critical',
        kind: 'insurance-expired',
        title: 'Lejárt biztosítás',
        description: `${expiredInsurance} jármű biztosítása lejárt`,
        link: '/vehicles?filter=attention',
        count: expiredInsurance
      });
    }

    if (soonInspection > 0) {
      items.push({
        id: 'inspection-soon',
        severity: 'warning',
        kind: 'inspection-soon',
        title: 'Lejáró műszaki vizsga',
        description: `${soonInspection} jármű műszaki vizsgája hamarosan lejár`,
        link: '/vehicles?filter=attention',
        count: soonInspection
      });
    }

    if (soonInsurance > 0) {
      items.push({
        id: 'insurance-soon',
        severity: 'warning',
        kind: 'insurance-soon',
        title: 'Lejáró biztosítás',
        description: `${soonInsurance} jármű biztosítása hamarosan lejár`,
        link: '/vehicles?filter=attention',
        count: soonInsurance
      });
    }

    // Critical items first, then warnings
    return items.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  }

  async upcoming(ctx: TenantContext): Promise<UpcomingEvent[]> {
    const tenantId = ctx.tenantId;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + UPCOMING_DAYS);

    const vehicles = await this.vehicles
      .find({
        tenantId,
        active: true,
        $or: [
          { inspectionExpiry: { $exists: true, $ne: null, $lte: horizon } },
          { insuranceExpiry: { $exists: true, $ne: null, $lte: horizon } }
        ]
      })
      .lean();

    const events: UpcomingEvent[] = [];
    for (const v of vehicles) {
      const name = `${v.manufacturer} ${v.model} · ${v.licensePlate}`;
      if (v.inspectionExpiry) {
        const d = new Date(v.inspectionExpiry);
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        events.push({
          id: `${v._id}-inspection`,
          severity: days < 0 ? 'critical' : 'warning',
          kind: 'inspection',
          vehicleId: String(v._id),
          vehicleName: name,
          date: d.toISOString(),
          daysUntil: days
        });
      }
      if (v.insuranceExpiry) {
        const d = new Date(v.insuranceExpiry);
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        events.push({
          id: `${v._id}-insurance`,
          severity: days < 0 ? 'critical' : 'warning',
          kind: 'insurance',
          vehicleId: String(v._id),
          vehicleName: name,
          date: d.toISOString(),
          daysUntil: days
        });
      }
    }

    return events.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10);
  }

  async activity(ctx: TenantContext, limit = 8): Promise<ActivityEntry[]> {
    const tenantId = ctx.tenantId;
    const logs = await this.auditLogs
      .find({ tenantId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (logs.length === 0) return [];

    const userIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))];
    const users = userIds.length > 0
      ? await this.users.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } }).select('username email').lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u.username || u.email]));

    return logs.map((log) => ({
      _id: String(log._id),
      actorName: userMap.get(log.actorUserId) ?? log.actorUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp)
    }));
  }

  async movement(ctx: TenantContext, days = 30): Promise<MovementBucket[]> {
    const tenantId = ctx.tenantId;
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const rows = await this.transactions.aggregate<{
      _id: string;
      stockIn: number;
      assigned: number;
      returned: number;
    }>([
      { $match: { tenantId, timestamp: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          stockIn: { $sum: { $cond: [{ $eq: ['$type', 'STOCK_IN'] }, '$quantity', 0] } },
          assigned: { $sum: { $cond: [{ $eq: ['$type', 'ASSIGN'] }, '$quantity', 0] } },
          returned: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$quantity', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build a complete bucket list so empty days show as zero (no fabricated values).
    const byDate = new Map(rows.map((r) => [r._id, r]));
    const buckets: MovementBucket[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < safeDays; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      const row = byDate.get(key);
      buckets.push({
        date: key,
        stockIn: row?.stockIn ?? 0,
        assigned: row?.assigned ?? 0,
        returned: row?.returned ?? 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }
}
