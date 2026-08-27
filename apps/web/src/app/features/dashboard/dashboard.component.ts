import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective, AppIconName } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { MetricCardComponent } from '../../shared/ui/feedback.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

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
  imports: [IconDirective, TooltipDirective, MetricCardComponent, TranslatePipe],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'dashboard.title' | translate }}</h1>
          <p>{{ 'dashboard.subtitle' | translate }}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
            } @else {
              <span appIcon="RefreshCw" [size]="16"></span>
            }
            {{ 'dashboard.refresh' | translate }}
          </button>
        </div>
      </div>

      <div class="metrics">
        @for (metric of metricCards(); track metric.labelKey) {
          <app-metric-card
            [icon]="metric.icon"
            [label]="metric.labelKey | translate"
            [value]="metric.value"
            [tone]="metric.tone"
            [hint]="metric.hint"
          />
        }
      </div>

      <div class="summary-grid">
        <section class="card">
          <div class="card-head">
            <div>
              <h2>{{ 'dashboard.warehouseReadiness' | translate }}</h2>
              <p>{{ inventoryReadiness() }}{{ 'dashboard.warehouseReadinessText' | translate }}</p>
            </div>
            <span class="badge badge--brand">{{ inventoryReadiness() }}%</span>
          </div>
          <div class="card-body">
            <div class="progress-track"><span [style.width.%]="inventoryReadiness()"></span></div>
            <div class="progress-legend">
              <span><span class="legend-dot brand"></span>{{ 'dashboard.inventoryItems' | translate }}: {{ summary().inventoryItems }}</span>
              <span><span class="legend-dot warn"></span>{{ 'dashboard.lowStock' | translate }}: {{ summary().lowStock }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <h2>{{ 'dashboard.fleetUtilization' | translate }}</h2>
              <p>{{ fleetUtilization() }}{{ 'dashboard.fleetUtilizationText' | translate }}</p>
            </div>
            <span class="badge badge--info">{{ fleetUtilization() }}%</span>
          </div>
          <div class="card-body">
            <div class="progress-track blue"><span [style.width.%]="fleetUtilization()"></span></div>
            <div class="progress-legend">
              <span><span class="legend-dot info"></span>{{ 'dashboard.activeVehicles' | translate }}: {{ summary().activeVehicles }}</span>
              <span><span class="legend-dot brand"></span>{{ 'dashboard.assignedVehicles' | translate }}: {{ summary().assignedVehicles }}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .progress-legend {
      display: flex;
      gap: var(--space-5);
      margin-top: var(--space-4);
      flex-wrap: wrap;
    }
    .progress-legend span {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--muted);
    }
    .legend-dot {
      width: 8px; height: 8px; border-radius: 999px;
      background: var(--brand);
    }
    .legend-dot.warn { background: var(--warn); }
    .legend-dot.info { background: var(--accent-600); }
    @media (max-width: 980px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { .metrics, .summary-grid { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly i18n = inject(I18nService);
  readonly loading = signal(false);
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
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });
  }

  metricCards() {
    const data = this.summary();
    return [
      {
        labelKey: 'dashboard.inventoryItems',
        value: data.inventoryItems,
        tone: 'neutral' as const,
        icon: 'Package' as AppIconName,
        hint: `${data.inventoryItems} tracked`
      },
      {
        labelKey: 'dashboard.lowStock',
        value: data.lowStock,
        tone: (data.lowStock > 0 ? 'warn' : 'neutral') as 'warn' | 'neutral',
        icon: 'TriangleAlert' as AppIconName,
        hint: data.lowStock > 0 ? 'Needs attention' : 'Healthy'
      },
      {
        labelKey: 'dashboard.assignedAssets',
        value: data.assignedAssets,
        tone: 'info' as const,
        icon: 'ClipboardCheck' as AppIconName,
        hint: 'Currently issued'
      },
      {
        labelKey: 'dashboard.activeEmployees',
        value: data.activeEmployees,
        tone: 'neutral' as const,
        icon: 'Users' as AppIconName,
        hint: 'In workforce'
      },
      {
        labelKey: 'dashboard.activeVehicles',
        value: data.activeVehicles,
        tone: 'neutral' as const,
        icon: 'Truck' as AppIconName,
        hint: 'In fleet'
      },
      {
        labelKey: 'dashboard.assignedVehicles',
        value: data.assignedVehicles,
        tone: 'info' as const,
        icon: 'KeyRound' as AppIconName,
        hint: 'On the road'
      }
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
    if (this.loading()) return;
    this.loading.set(true);
    this.api.get<DashboardSummary>('/dashboard').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
