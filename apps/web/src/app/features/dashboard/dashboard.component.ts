import { Component, effect, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';

interface DashboardSummary {
  inventoryItems: number;
  lowStock: number;
  activeEmployees: number;
  activeVehicles: number;
  assignedVehicles: number;
  assignedAssets: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconDirective],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Dashboard</h1>
          <p>Live operating snapshot for the active workspace.</p>
        </div>
        <button class="ghost-button" (click)="load()"><span appIcon="RefreshCw"></span>Refresh</button>
      </div>

      <div class="metrics">
        @for (metric of metricCards(); track metric.label) {
          <article class="data-card" [class.warn]="metric.tone === 'warn'" [class.info]="metric.tone === 'info'">
            <span class="metric-icon" [appIcon]="metric.icon"></span>
            <div>
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </article>
        }
      </div>

      <div class="summary-grid">
        <section class="data-card">
          <h2>Warehouse readiness</h2>
          <div class="progress-track"><span [style.width.%]="inventoryReadiness()"></span></div>
          <p>{{ inventoryReadiness() }}% of tracked stock is currently available.</p>
        </section>
        <section class="data-card">
          <h2>Fleet utilization</h2>
          <div class="progress-track blue"><span [style.width.%]="fleetUtilization()"></span></div>
          <p>{{ fleetUtilization() }}% of active vehicles are assigned.</p>
        </section>
      </div>
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 18px; }
    p { margin: 6px 0 0; color: var(--muted); }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    article { display: grid; grid-template-columns: 38px 1fr; gap: 10px; align-items: center; }
    article.warn { background: var(--warn-soft); }
    article.info { background: var(--brand-2-soft); }
    .metric-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 8px; background: white; color: var(--brand); border: 1px solid var(--line); }
    article span { color: var(--muted); font-size: 14px; }
    article strong { display: block; font-size: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .progress-track { height: 10px; border-radius: 999px; background: var(--line); overflow: hidden; }
    .progress-track span { display: block; height: 100%; background: var(--brand); border-radius: inherit; }
    .progress-track.blue span { background: var(--brand-2); }
    @media (max-width: 900px) { .metrics, .summary-grid { grid-template-columns: 1fr; } }
  `
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  readonly summary = signal<DashboardSummary>({
    inventoryItems: 0,
    lowStock: 0,
    activeEmployees: 0,
    activeVehicles: 0,
    assignedVehicles: 0,
    assignedAssets: 0
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  metricCards() {
    const data = this.summary();
    return [
      { label: 'Inventory items', value: data.inventoryItems, tone: 'neutral', icon: 'Package' as const },
      { label: 'Low stock', value: data.lowStock, tone: data.lowStock > 0 ? 'warn' : 'neutral', icon: 'CircleAlert' as const },
      { label: 'Assigned assets', value: data.assignedAssets, tone: 'info', icon: 'ClipboardCheck' as const },
      { label: 'Active employees', value: data.activeEmployees, tone: 'neutral', icon: 'Users' as const },
      { label: 'Active vehicles', value: data.activeVehicles, tone: 'neutral', icon: 'Truck' as const },
      { label: 'Assigned vehicles', value: data.assignedVehicles, tone: 'info', icon: 'KeyRound' as const }
    ];
  }

  inventoryReadiness() {
    const data = this.summary();
    if (data.inventoryItems === 0) return 100;
    return Math.max(0, Math.min(100, Math.round(((data.inventoryItems - data.lowStock) / data.inventoryItems) * 100)));
  }

  fleetUtilization() {
    const data = this.summary();
    if (data.activeVehicles === 0) return 0;
    return Math.max(0, Math.min(100, Math.round((data.assignedVehicles / data.activeVehicles) * 100)));
  }

  load() {
    this.api.get<DashboardSummary>('/dashboard').subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => undefined
    });
  }
}
