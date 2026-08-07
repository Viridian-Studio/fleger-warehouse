import type { IndexDescription } from 'mongodb';

export interface CollectionDefinition {
  name: string;
  indexes: IndexDescription[];
}

export const COLLECTION_DEFINITIONS: CollectionDefinition[] = [
  {
    name: 'applicationdetails',
    indexes: [
      { key: { key: 1 }, unique: true, name: 'uniq_application_details_key' }
    ]
  },
  {
    name: 'tenants',
    indexes: [
      { key: { slug: 1 }, unique: true, name: 'uniq_tenants_slug' },
      { key: { status: 1 }, name: 'idx_tenants_status' },
      { key: { planCode: 1 }, name: 'idx_tenants_plan' }
    ]
  },
  {
    name: 'users',
    indexes: [
      { key: { username: 1 }, unique: true, sparse: true, name: 'uniq_users_username' },
      { key: { email: 1 }, unique: true, name: 'uniq_users_email' },
      { key: { globalStatus: 1 }, name: 'idx_users_global_status' }
    ]
  },
  {
    name: 'tenantmemberships',
    indexes: [
      { key: { userId: 1, tenantId: 1 }, unique: true, name: 'uniq_memberships_user_tenant' },
      { key: { tenantId: 1, status: 1 }, name: 'idx_memberships_tenant_status' },
      { key: { tenantSlug: 1, status: 1 }, name: 'idx_memberships_slug_status' }
    ]
  },
  {
    name: 'roles',
    indexes: [
      { key: { tenantId: 1, name: 1 }, unique: true, name: 'uniq_roles_tenant_name' },
      { key: { tenantId: 1, systemRole: 1 }, name: 'idx_roles_tenant_system' }
    ]
  },
  {
    name: 'departments',
    indexes: [
      { key: { tenantId: 1, name: 1 }, unique: true, name: 'uniq_departments_tenant_name' },
      { key: { tenantId: 1, active: 1 }, name: 'idx_departments_tenant_active' }
    ]
  },
  {
    name: 'employees',
    indexes: [
      { key: { tenantId: 1, employeeNumber: 1 }, unique: true, name: 'uniq_employees_tenant_number' },
      { key: { tenantId: 1, active: 1 }, name: 'idx_employees_tenant_active' },
      { key: { tenantId: 1, lastName: 1, firstName: 1 }, name: 'idx_employees_tenant_name' }
    ]
  },
  {
    name: 'inventoryitems',
    indexes: [
      { key: { tenantId: 1, inventoryNumber: 1 }, unique: true, name: 'uniq_inventory_tenant_number' },
      { key: { tenantId: 1, type: 1, status: 1 }, name: 'idx_inventory_tenant_type_status' },
      { key: { tenantId: 1, availableQuantity: 1 }, name: 'idx_inventory_tenant_available' }
    ]
  },
  {
    name: 'inventorytransactions',
    indexes: [
      { key: { tenantId: 1, timestamp: -1 }, name: 'idx_inventory_transactions_tenant_time' },
      { key: { tenantId: 1, itemId: 1, timestamp: -1 }, name: 'idx_inventory_transactions_item_time' }
    ]
  },
  {
    name: 'vehicles',
    indexes: [
      { key: { tenantId: 1, licensePlate: 1 }, unique: true, name: 'uniq_vehicles_tenant_plate' },
      { key: { tenantId: 1, status: 1 }, name: 'idx_vehicles_tenant_status' },
      { key: { tenantId: 1, active: 1 }, name: 'idx_vehicles_tenant_active' }
    ]
  },
  {
    name: 'assignments',
    indexes: [
      { key: { tenantId: 1, itemId: 1, status: 1 }, name: 'idx_assignments_item_status' },
      { key: { tenantId: 1, targetType: 1, targetId: 1, status: 1 }, name: 'idx_assignments_target_status' }
    ]
  },
  {
    name: 'vehicleassignments',
    indexes: [
      { key: { tenantId: 1, vehicleId: 1, status: 1 }, name: 'idx_vehicle_assignments_vehicle_status' },
      { key: { tenantId: 1, employeeId: 1, status: 1 }, name: 'idx_vehicle_assignments_employee_status' }
    ]
  },
  {
    name: 'auditlogs',
    indexes: [
      { key: { tenantId: 1, timestamp: -1 }, name: 'idx_audit_logs_tenant_time' },
      { key: { tenantId: 1, entityType: 1, entityId: 1 }, name: 'idx_audit_logs_entity' }
    ]
  },
  {
    name: 'tenantfeatures',
    indexes: [
      { key: { tenantId: 1, feature: 1 }, unique: true, name: 'uniq_tenant_features_feature' },
      { key: { tenantId: 1, enabled: 1 }, name: 'idx_tenant_features_enabled' }
    ]
  },
  {
    name: 'invitations',
    indexes: [
      { key: { tenantId: 1, email: 1, status: 1 }, name: 'idx_invitations_tenant_email_status' },
      { key: { tokenHash: 1 }, unique: true, name: 'uniq_invitations_token_hash' },
      { key: { expiresAt: 1 }, name: 'idx_invitations_expires_at', expireAfterSeconds: 0 }
    ]
  }
];
