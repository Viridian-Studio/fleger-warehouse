import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';

interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  actorUserId: string;
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="page">
      <div class="title-row"><h1>Audit Logs</h1><span>{{ logs().length }} recent events</span></div>
      <div class="table">
        <div class="row head"><span>Action</span><span>Entity</span><span>Actor</span><span>Time</span></div>
        @for (log of logs(); track log._id) {
          <div class="row">
            <span>{{ log.action }}</span>
            <span>{{ log.entityType }} · {{ log.entityId }}</span>
            <span>{{ log.actorUserId }}</span>
            <span>{{ log.timestamp | date: 'yyyy-MM-dd HH:mm' }}</span>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .page { display: grid; gap: 18px; }
    .title-row { display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; font-size: 28px; }
    .title-row span { color: var(--muted); }
    .table { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: white; }
    .row { display: grid; grid-template-columns: 1fr 1.2fr 1fr .9fr; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); }
    .row:first-child { border-top: 0; }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; }
  `
})
export class AuditLogComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  readonly logs = signal<AuditLog[]>([]);

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  load() {
    this.api.get<AuditLog[]>('/audit-log').subscribe({
      next: (logs) => this.logs.set(logs),
      error: () => this.logs.set([])
    });
  }
}
