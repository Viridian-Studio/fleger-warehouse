import { Component, computed, input, output, signal } from '@angular/core';
import { IconDirective } from '../../../shared/ui/icon.directive';
import { TooltipDirective } from '../../../shared/ui/tooltip.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MovementBucket } from '../dashboard.types';

interface FrameOption {
  days: number;
  label: string;
}

@Component({
  selector: 'app-movement-chart',
  standalone: true,
  imports: [IconDirective, TooltipDirective, TranslatePipe],
  template: `
    <section class="card">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" appIcon="Boxes" [size]="18"></span>
          <div>
            <h2>{{ 'dashboard.movement' | translate }}</h2>
            <p>{{ 'dashboard.movementDesc' | translate }}</p>
          </div>
        </div>
        <div class="frame-tabs" role="tablist">
          @for (opt of frames; track opt.days) {
            <button class="frame-tab" [class.active]="frame() === opt.days" type="button" role="tab" (click)="frame.set(opt.days); frameChange.emit(opt.days)">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>
      <div class="card-body">
        @if (loading()) {
          <div class="chart-skeleton">
            <div class="chart-bars-skel">
              @for (i of barSkeletons; track i) {
                <span class="skeleton chart-bar-skel" [style.height.%]="20 + (i * 11) % 60"></span>
              }
            </div>
          </div>
        } @else if (error()) {
          <div class="chart-error">
            <span class="state-icon" appIcon="TriangleAlert" [size]="20"></span>
            <p>{{ 'dashboard.movementError' | translate }}</p>
            <button class="btn btn--ghost btn--sm" type="button" (click)="retry.emit()">
              <span appIcon="RefreshCw" [size]="14"></span>{{ 'dashboard.retry' | translate }}
            </button>
          </div>
        } @else if (totals().total === 0) {
          <div class="chart-empty">
            <span class="empty-icon" appIcon="Boxes" [size]="22"></span>
            <p>{{ 'dashboard.movementEmpty' | translate }}</p>
          </div>
        } @else {
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot brand"></span>{{ 'dashboard.movementIn' | translate }} · {{ totals().stockIn }}</span>
            <span class="legend-item"><span class="legend-dot info"></span>{{ 'dashboard.movementOut' | translate }} · {{ totals().assigned }}</span>
            <span class="legend-item"><span class="legend-dot success"></span>{{ 'dashboard.movementReturn' | translate }} · {{ totals().returned }}</span>
          </div>
          <div class="chart" [style.--bars]="visibleBuckets().length">
            <div class="chart-axis">
              <span>{{ maxValue() }}</span>
              <span>0</span>
            </div>
            <div class="chart-bars">
              @for (bucket of visibleBuckets(); track bucket.date) {
                <div class="bar-group" [appTooltip]="bucket.date + ' · in ' + bucket.stockIn + ' / out ' + bucket.assigned + ' / ret ' + bucket.returned">
                  <div class="bar-stack">
                    @if (bucket.stockIn > 0) {
                      <span class="bar bar--in" [style.height.%]="pct(bucket.stockIn)"></span>
                    }
                    @if (bucket.assigned > 0) {
                      <span class="bar bar--out" [style.height.%]="pct(bucket.assigned)"></span>
                    }
                    @if (bucket.returned > 0) {
                      <span class="bar bar--ret" [style.height.%]="pct(bucket.returned)"></span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); flex: 0 0 auto; }
    .head-title h2 { font-size: 16px; }
    .head-title p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

    .frame-tabs { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-soft); }
    .frame-tab { padding: 4px 10px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; }
    .frame-tab:hover { color: var(--ink); }
    .frame-tab.active { background: var(--surface); color: var(--brand-ink); box-shadow: var(--shadow-sm); }

    .chart-legend { display: flex; gap: var(--space-4); margin-bottom: var(--space-3); flex-wrap: wrap; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .legend-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--brand); }
    .legend-dot.info { background: var(--accent-600); }
    .legend-dot.success { background: var(--success); }

    .chart { display: grid; grid-template-columns: 28px 1fr; gap: var(--space-2); height: 180px; }
    .chart-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; font-size: 10px; color: var(--muted-soft); padding-top: 2px; }
    .chart-bars { display: grid; grid-template-columns: repeat(var(--bars), minmax(0, 1fr)); gap: 2px; align-items: flex-end; border-bottom: 1px solid var(--line); padding-bottom: 1px; }
    .bar-group { display: grid; place-items: end center; height: 100%; min-width: 0; }
    .bar-stack { display: flex; align-items: flex-end; gap: 1px; height: 100%; width: 100%; max-width: 14px; justify-content: center; }
    .bar { width: 4px; min-height: 2px; border-radius: 2px 2px 0 0; transition: height var(--dur-slow) var(--ease-out); }
    .bar--in { background: var(--brand); }
    .bar--out { background: var(--accent-600); }
    .bar--ret { background: var(--success); }

    .chart-empty, .chart-error { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-8); text-align: center; }
    .chart-empty .empty-icon { color: var(--muted); }
    .chart-empty p { margin: 0; color: var(--muted); font-size: 13px; }
    .chart-error .state-icon { color: var(--danger); }
    .chart-error p { margin: 0; color: var(--muted); font-size: 13px; }

    .chart-skeleton { height: 180px; }
    .chart-bars-skel { display: flex; align-items: flex-end; gap: 4px; height: 100%; border-bottom: 1px solid var(--line); }
    .chart-bar-skel { width: 6px; border-radius: 2px 2px 0 0; }

    @media (max-width: 640px) {
      .chart { height: 140px; }
      .bar-stack { max-width: 10px; }
      .bar { width: 3px; }
    }
  `]
})
export class MovementChartComponent {
  readonly buckets = input<MovementBucket[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();
  readonly frameChange = output<number>();

  readonly frames: FrameOption[] = [
    { days: 7, label: '7 nap' },
    { days: 30, label: '30 nap' },
    { days: 90, label: '90 nap' }
  ];

  readonly frame = signal(30);
  readonly barSkeletons = Array.from({ length: 24 }, (_, i) => i + 1);

  readonly visibleBuckets = computed<MovementBucket[]>(() => {
    const all = this.buckets();
    const f = this.frame();
    if (all.length === 0) return [];
    // The backend already returns exactly `frame` buckets; if the count differs, trim to the newest frame.
    if (all.length <= f) return all;
    return all.slice(all.length - f);
  });

  readonly maxValue = computed(() => {
    const buckets = this.visibleBuckets();
    let max = 0;
    for (const b of buckets) {
      max = Math.max(max, b.stockIn, b.assigned, b.returned);
    }
    return max;
  });

  readonly totals = computed(() => {
    const buckets = this.visibleBuckets();
    let stockIn = 0, assigned = 0, returned = 0;
    for (const b of buckets) {
      stockIn += b.stockIn;
      assigned += b.assigned;
      returned += b.returned;
    }
    return { stockIn, assigned, returned, total: stockIn + assigned + returned };
  });

  pct(value: number): number {
    const max = this.maxValue();
    if (max === 0) return 0;
    return Math.max(2, Math.round((value / max) * 100));
  }
}
