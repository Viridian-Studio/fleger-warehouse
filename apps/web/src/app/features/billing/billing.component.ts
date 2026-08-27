import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';

interface Plan {
  code: string;
  name: string;
  features: string[];
  limits: Record<string, number>;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [IconDirective, TooltipDirective, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Billing</h1>
          <p>Available plans and their feature limits.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Reload plans">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Reload
          </button>
        </div>
      </div>

      @if (loading() && plans().length === 0) {
        <div class="grid">
          @for (i of skeletons; track i) {
            <div class="card plan-card">
              <span class="skeleton skeleton--line" style="width: 50%"></span>
              <span class="skeleton skeleton--line" style="width: 30%"></span>
              <span class="skeleton skeleton--text" style="width: 90%"></span>
              <span class="skeleton skeleton--text" style="width: 70%"></span>
            </div>
          }
        </div>
      } @else if (plans().length === 0) {
        <app-empty-state icon="CreditCard" title="No plans available" description="Plans will appear here once billing is configured."></app-empty-state>
      } @else {
        <div class="grid">
          @for (plan of plans(); track plan.code) {
            <article class="card plan-card">
              <div class="plan-head">
                <span class="plan-icon" appIcon="Sparkles" [size]="18"></span>
                <div>
                  <strong>{{ plan.name }}</strong>
                  <span class="mono">{{ plan.code }}</span>
                </div>
              </div>
              <ul class="plan-features">
                @for (feature of plan.features; track feature) {
                  <li><span appIcon="Check" [size]="14"></span>{{ feature }}</li>
                }
              </ul>
              @if (hasLimits(plan.limits)) {
                <div class="plan-limits">
                  <span class="eyebrow">Limits</span>
                  <div class="limit-grid">
                    @for (entry of limitEntries(plan.limits); track entry.key) {
                      <div class="limit-item">
                        <small>{{ entry.key }}</small>
                        <strong>{{ entry.value }}</strong>
                      </div>
                    }
                  </div>
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
    .plan-card { display: grid; gap: var(--space-3); align-content: start; }
    .plan-head { display: flex; align-items: center; gap: var(--space-3); }
    .plan-icon {
      display: grid; place-items: center; width: 36px; height: 36px;
      border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink);
    }
    .plan-head strong { display: block; font-size: 16px; }
    .plan-head .mono { color: var(--muted); font-size: 12px; }
    .plan-features { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .plan-features li { display: flex; align-items: center; gap: var(--space-2); font-size: 13px; color: var(--ink); }
    .plan-features li span { color: var(--success); display: inline-flex; }
    .plan-limits { display: grid; gap: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--line); }
    .limit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); }
    .limit-item { display: grid; gap: 2px; padding: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-soft); }
    .limit-item small { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .limit-item strong { font-size: 14px; color: var(--ink-strong); }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class BillingComponent {
  private readonly api = inject(ApiService);
  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(false);
  readonly skeletons = [1, 2, 3];

  constructor() {
    this.load();
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.get<Plan[]>('/plans').subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  limitEntries(limits: Record<string, number>) {
    return Object.entries(limits).map(([key, value]) => ({ key, value }));
  }

  hasLimits(limits: Record<string, number> | undefined): boolean {
    return Boolean(limits && Object.keys(limits).length);
  }
}
