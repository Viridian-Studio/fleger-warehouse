import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const REDACTED_KEYS = new Set(['password', 'passwordHash', 'accessToken', 'refreshToken', 'token', 'authorization']);

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditLogs: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();
    request.requestId = request.headers['x-request-id'] ?? randomUUID();

    return next.handle().pipe(
      tap({
        next: (result) => {
        const tenantId = request.tenantContext?.tenantId;
        const userId = request.user?.sub;
        console.log(
          JSON.stringify({
            requestId: request.requestId,
            tenantId,
            userId,
            method: request.method,
            path: request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt
          })
        );

          this.recordAudit(request, response, result, 'success');
        },
        error: (error) => {
          this.recordAudit(request, response, undefined, 'failed', error);
        }
      })
    );
  }

  private recordAudit(
    request: Record<string, unknown>,
    response: Record<string, unknown>,
    result: unknown,
    outcome: 'success' | 'failed',
    error?: { message?: string; status?: number }
  ) {
    const method = String(request['method'] ?? '');
    const url = String(request['url'] ?? '');
    const tenantContext = request['tenantContext'] as { tenantId?: string; userId?: string } | undefined;
    const tenantId = tenantContext?.tenantId;
    const userIdValue = tenantContext?.userId ?? this.valueAt(request['user'], 'sub');
    const userId = typeof userIdValue === 'string' ? userIdValue : undefined;

    if (!this.shouldAudit(method, url, tenantId, userId)) return;
    if (!tenantId || !userId) return;

    void this.auditLogs.record({
      tenantId,
      actorUserId: userId,
      action: this.actionFor(method, url),
      entityType: this.entityTypeFor(url),
      entityId: this.entityIdFor(request, result),
      ipAddress: String(request['ip'] ?? ''),
      metadata: {
        outcome,
        requestId: request['requestId'],
        method,
        path: url,
        statusCode: response['statusCode'] ?? error?.status,
        error: error?.message,
        params: this.redact(request['params'] ?? {}),
        query: this.redact(request['query'] ?? {}),
        body: this.redact(request['body'] ?? {})
      }
    }).catch((auditError) => {
      console.error(JSON.stringify({ requestId: request['requestId'], auditLogError: auditError.message }));
    });
  }

  private shouldAudit(method: string, path: string, tenantId?: string, userId?: string) {
    return Boolean(tenantId && userId && !SAFE_METHODS.has(method) && !path.includes('/audit-log'));
  }

  private actionFor(method: string, path: string) {
    const segments = this.pathSegments(path);
    return `${method.toLowerCase()}.${segments.join('.')}`;
  }

  private entityTypeFor(path: string) {
    const [resource, child] = this.pathSegments(path);
    if (resource === 'inventory' && child === 'items') return 'InventoryItem';
    if (resource === 'assignments' && child === 'inventory') return 'InventoryAssignment';
    if (resource === 'assignments' && child === 'vehicles') return 'VehicleAssignment';
    return this.toPascalCase(this.singularize(resource || 'event'));
  }

  private entityIdFor(request: Record<string, unknown>, result: unknown) {
    const params = request['params'] as Record<string, unknown> | undefined;
    const body = request['body'] as Record<string, unknown> | undefined;
    return String(
      params?.['id'] ??
      this.valueAt(result, '_id') ??
      this.valueAt(result, 'id') ??
      body?.['id'] ??
      body?.['itemId'] ??
      body?.['vehicleId'] ??
      'unknown'
    );
  }

  private pathSegments(path: string) {
    return path
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .filter((segment) => segment !== 'api' && segment !== 'v1')
      .filter((segment) => !/^[0-9a-f]{24}$/i.test(segment));
  }

  private valueAt(value: unknown, key: string) {
    if (typeof value !== 'object' || value === null) return undefined;
    return (value as Record<string, unknown>)[key];
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (typeof value !== 'object' || value === null) return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : this.redact(item)
      ])
    );
  }

  private singularize(value: string) {
    return value.endsWith('ies') ? `${value.slice(0, -3)}y` : value.endsWith('s') ? value.slice(0, -1) : value;
  }

  private toPascalCase(value: string) {
    return value
      .split(/[-_.]/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join('');
  }
}
