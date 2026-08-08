import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { TenantSchema } from './modules/tenants/schemas/tenant.schema';
import { UserSchema } from './modules/users/schemas/user.schema';
import { RoleSchema } from './modules/roles/schemas/role.schema';
import { TenantMembershipSchema } from './modules/tenants/schemas/membership.schema';
import { EmployeeSchema } from './modules/employees/schemas/employee.schema';
import { DepartmentSchema } from './modules/departments/schemas/department.schema';
import { VehicleSchema } from './modules/vehicles/schemas/vehicle.schema';
import { InventoryItemSchema } from './modules/inventory/schemas/inventory-item.schema';
import { AuditLogSchema } from './modules/audit-log/schemas/audit-log.schema';
import { TenantFeatureSchema } from './modules/features/schemas/tenant-feature.schema';
import { ApplicationDetailsSchema } from './modules/application-details/schemas/application-details.schema';
import applicationDetails from './modules/application-details/application-details.json';

config({ path: resolve(__dirname, '../.env') });

const ALL_PERMISSIONS = [
  'inventory.read',
  'inventory.create',
  'inventory.update',
  'inventory.assign',
  'employee.read',
  'employee.create',
  'employee.update',
  'employee.disable',
  'vehicle.read',
  'vehicle.create',
  'vehicle.update',
  'vehicle.assign',
  'user.read',
  'user.invite',
  'user.disable',
  'audit.read',
  'role.manage',
  'settings.manage'
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fleger_warehouse');

  const Tenant = mongoose.model('Tenant', TenantSchema);
  const User = mongoose.model('User', UserSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const Membership = mongoose.model('TenantMembership', TenantMembershipSchema);
  const Department = mongoose.model('Department', DepartmentSchema);
  const Employee = mongoose.model('Employee', EmployeeSchema);
  const Vehicle = mongoose.model('Vehicle', VehicleSchema);
  const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);
  const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
  const TenantFeature = mongoose.model('TenantFeature', TenantFeatureSchema);
  const ApplicationDetails = mongoose.model('ApplicationDetails', ApplicationDetailsSchema);

  await Promise.all([
    ApplicationDetails.deleteMany({}),
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Membership.deleteMany({}),
    Department.deleteMany({}),
    Employee.deleteMany({}),
    Vehicle.deleteMany({}),
    InventoryItem.deleteMany({}),
    AuditLog.deleteMany({}),
    TenantFeature.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const flegerPasswordHash = await bcrypt.hash('Nemtom10', 12);

  await ApplicationDetails.create(applicationDetails);

  const platformAdmin = await User.create({
    username: 'platform',
    email: 'platform@fleger.test',
    passwordHash,
    globalStatus: 'ACTIVE',
    platformAdmin: true,
    superAdmin: true
  });

  const fleger = await Tenant.create({ name: 'Fleger', slug: 'fleger', status: 'ACTIVE', planCode: 'ENTERPRISE' });
  const acme = await Tenant.create({ name: 'ACME Kft.', slug: 'acme', status: 'ACTIVE', planCode: 'PRO' });
  const demo = await Tenant.create({ name: 'Demo Logistics Kft.', slug: 'demo-logistics', status: 'ACTIVE', planCode: 'STARTER' });

  const flegerAdminRole = await Role.create({
    tenantId: String(fleger._id),
    name: 'ADMIN',
    permissions: ALL_PERMISSIONS,
    systemRole: true
  });
  const acmeAdminRole = await Role.create({
    tenantId: String(acme._id),
    name: 'ADMIN',
    permissions: ALL_PERMISSIONS,
    systemRole: true
  });
  const demoAdminRole = await Role.create({
    tenantId: String(demo._id),
    name: 'ADMIN',
    permissions: ALL_PERMISSIONS,
    systemRole: true
  });

  const acmeAdmin = await User.create({ username: 'acme-admin', email: 'admin@acme.test', passwordHash, globalStatus: 'ACTIVE' });
  const demoAdmin = await User.create({ username: 'demo-admin', email: 'admin@demo.test', passwordHash, globalStatus: 'ACTIVE' });

  await Membership.create([
    {
      userId: flegerAdmin._id,
      tenantId: fleger._id,
      tenantSlug: fleger.slug,
      roleId: flegerAdminRole._id,
      permissions: ALL_PERMISSIONS,
      status: 'ACTIVE'
    },
    {
      userId: platformAdmin._id,
      tenantId: acme._id,
      tenantSlug: acme.slug,
      roleId: acmeAdminRole._id,
      permissions: ALL_PERMISSIONS,
      status: 'ACTIVE'
    },
    {
      userId: acmeAdmin._id,
      tenantId: acme._id,
      tenantSlug: acme.slug,
      roleId: acmeAdminRole._id,
      permissions: ALL_PERMISSIONS,
      status: 'ACTIVE'
    },
    {
      userId: demoAdmin._id,
      tenantId: demo._id,
      tenantSlug: demo.slug,
      roleId: demoAdminRole._id,
      permissions: ALL_PERMISSIONS,
      status: 'ACTIVE'
    }
  ]);

  const [acmeWarehouse, acmeLogistics, demoFleet, flegerAdminDepartment] = await Department.create([
    { tenantId: String(acme._id), name: 'Raktar', code: 'RKT', active: true },
    { tenantId: String(acme._id), name: 'Logisztika', code: 'LOG', active: true },
    { tenantId: String(demo._id), name: 'Fleet', code: 'FLT', active: true },
    { tenantId: String(fleger._id), name: 'Admin', code: 'ADM', active: true }
  ]);

  await Employee.create([
    { tenantId: String(acme._id), employeeNumber: 'ACME-001', firstName: 'Anna', lastName: 'Kovacs', active: true, departmentId: String(acmeWarehouse._id), department: acmeWarehouse.name },
    { tenantId: String(acme._id), employeeNumber: 'ACME-002', firstName: 'Bence', lastName: 'Nagy', active: true, departmentId: String(acmeLogistics._id), department: acmeLogistics.name },
    { tenantId: String(demo._id), employeeNumber: 'DEMO-001', firstName: 'Dora', lastName: 'Toth', active: true, departmentId: String(demoFleet._id), department: demoFleet.name },
    { tenantId: String(fleger._id), employeeNumber: 'FLG-001', firstName: 'Peti', lastName: 'Jovanovics', active: true, departmentId: String(flegerAdminDepartment._id), department: flegerAdminDepartment.name }
  ]);

  await Vehicle.create([
    { tenantId: String(acme._id), licensePlate: 'ABC-123', manufacturer: 'Ford', model: 'Transit', currentMileage: 88200 },
    { tenantId: String(demo._id), licensePlate: 'ABC-123', manufacturer: 'Mercedes-Benz', model: 'Sprinter', currentMileage: 42100 },
    { tenantId: String(fleger._id), licensePlate: 'FLG-001', manufacturer: 'Toyota', model: 'Proace', currentMileage: 12000 }
  ]);

  await InventoryItem.create([
    { tenantId: String(acme._id), name: 'Vedokesztyu', inventoryNumber: 'INV-001', type: 'QUANTITY', quantity: 100, availableQuantity: 100, unit: 'par' },
    { tenantId: String(acme._id), name: 'Furogep', inventoryNumber: 'INV-002', type: 'ASSET', quantity: 1, availableQuantity: 1, unit: 'db' },
    { tenantId: String(demo._id), name: 'Spanifer', inventoryNumber: 'INV-001', type: 'QUANTITY', quantity: 40, availableQuantity: 40, unit: 'db' },
    { tenantId: String(fleger._id), name: 'Admin laptop', inventoryNumber: 'FLG-INV-001', type: 'ASSET', quantity: 1, availableQuantity: 1, unit: 'db' }
  ]);

  await TenantFeature.create([
    { tenantId: String(fleger._id), feature: 'inventoryManagement', enabled: true },
    { tenantId: String(fleger._id), feature: 'vehicleManagement', enabled: true },
    { tenantId: String(fleger._id), feature: 'auditLogs', enabled: true },
    { tenantId: String(fleger._id), feature: 'advancedRoles', enabled: true },
    { tenantId: String(acme._id), feature: 'inventoryManagement', enabled: true },
    { tenantId: String(acme._id), feature: 'vehicleManagement', enabled: true },
    { tenantId: String(demo._id), feature: 'inventoryManagement', enabled: true }
  ]);

  await AuditLog.create([
    {
      tenantId: String(fleger._id),
      actorUserId: String(flegerAdmin._id),
      action: 'tenant.seeded',
      entityType: 'Tenant',
      entityId: String(fleger._id),
      timestamp: new Date(),
      metadata: { slug: fleger.slug }
    },
    {
      tenantId: String(acme._id),
      actorUserId: String(acmeAdmin._id),
      action: 'tenant.seeded',
      entityType: 'Tenant',
      entityId: String(acme._id),
      timestamp: new Date(),
      metadata: { slug: acme.slug }
    }
  ]);

  console.log('Seed complete. Demo password: Password123!. Fleger admin: jovanovicsp@gmail.com / Nemtom10');
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
