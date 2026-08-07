export const PLAN_CATALOG = {
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    features: ['inventoryManagement', 'vehicleManagement'],
    limits: { maxUsers: 5, maxEmployees: 50, maxVehicles: 10, maxInventoryItems: 250 }
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    features: ['inventoryManagement', 'vehicleManagement', 'auditLogs', 'advancedRoles'],
    limits: { maxUsers: 50, maxEmployees: 500, maxVehicles: 100, maxInventoryItems: 5000 }
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    features: ['inventoryManagement', 'vehicleManagement', 'auditLogs', 'advancedRoles', 'apiAccess'],
    limits: { maxUsers: -1, maxEmployees: -1, maxVehicles: -1, maxInventoryItems: -1 }
  }
} as const;
