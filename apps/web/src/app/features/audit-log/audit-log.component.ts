import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';

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
  imports: [DatePipe, IconDirective, TooltipDirective, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Audit Logs</h1>
          <p>{{ logs().length }} recent events across the workspace.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
        </div>
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Activity</h2><span class="table-meta">{{ logs().length }} events</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 28%"></span>
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 16%"></span>
                </div>
              }
            </div>
          } @else if (logs().length === 0) {
            <app-empty-state icon="ScrollText" title="No audit events yet" description="Workspace activity will appear here as your team performs actions."></app-empty-state>
          } @else {
            <div class="row head"><span>Action</span><span>Entity</span><span>Actor</span><span>Time</span></div>
            @for (log of logs(); track log._id) {
              <div class="row">
                <span class="badge badge--brand">{{ log.action }}</span>
                <span class="truncate"><span class="col-muted">{{ log.entityType }}</span> · <span class="mono">{{ log.entityId }}</span></span>
                <span class="col-muted mono truncate">{{ log.actorUserId }}</span>
                <span class="col-muted">{{ log.timestamp | date: 'yyyy-MM-dd HH:mm' }}</span>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1fr 1.2fr 1fr .9fr; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    @media (max-width: 800px) {
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3) { display: none; }
      .row.head { display: none; }
    }
  `]
})
export class AuditLogComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  readonly logs = signal<AuditLog[]>([]);
  readonly loading = signal(false);
  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.get<AuditLog[]>('/audit-log').subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => {
        this.logs.set([]);
        this.loading.set(false);
      }
    });
  }
}
