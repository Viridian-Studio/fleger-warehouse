export interface DashboardSummary {
  inventoryItems: number;
  lowStock: number;
  activeEmployees: number;
  activeVehicles: number;
  assignedVehicles: number;
  assignedAssets: number;
  availableVehicles: number;
  serviceVehicles: number;
  availableUnits: number;
}

export type AttentionSeverity = 'critical' | 'warning';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  kind: 'low-stock' | 'vehicle-service' | 'inspection-expired' | 'insurance-expired' | 'inspection-soon' | 'insurance-soon';
  title: string;
  description: string;
  link: string;
  count: number;
}

export interface UpcomingEvent {
  id: string;
  severity: AttentionSeverity;
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

export type LoadState = 'loading' | 'ready' | 'error';
