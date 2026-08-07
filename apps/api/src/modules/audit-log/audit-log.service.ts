import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';

export interface AuditLogEvent {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) private readonly auditLogs: Model<AuditLog>) {}

  record(event: AuditLogEvent) {
    return this.auditLogs.create({
      ...event,
      timestamp: new Date(),
      metadata: event.metadata ?? {}
    });
  }
}
