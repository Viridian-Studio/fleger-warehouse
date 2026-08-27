import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective, AppIconName } from '../../../shared/ui/icon.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AttentionItem } from '../dashboard.types';

@Component({
  selector: 'app-attention-panel',
  standalone: true,
  imports: [IconDirective, RouterLink, TranslatePipe],
  template: `
    <section class="card attention-card" [class.has-issues]="items().length > 0">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" [class.is-clean]="items().length === 0" [appIcon]="items().length > 0 ? 'ShieldAlert' : 'ShieldCheck'" [size]="18"></span>
          <div>
            <h2>{{ 'dashboard.attention' | translate }}</h2>
            <p>{{ items().length > 0 ? (items().length + ' ' + ('dashboard.attentionCount' | translate)) : ('dashboard.attentionEmpty' | translate) }}</p>
          </div>
        </div>
        @if (items().length > 0) {
          <span class="badge" [class.badge--danger]="criticalCount() > 0" [class.badge--warn]="criticalCount() === 0">{{ items().length }}</span>
        }
      </div>

      <div class="card-body">
        @if (loading()) {
          <div class="attention-skeletons">
            @for (i of skeletons; track i) {
              <div class="attention-skel">
                <span class="skeleton skeleton--circle" style="width:32px;height:32px"></span>
                <div class="attention-skel-body">
                  <span class="skeleton skeleton--text" style="width: 45%"></span>
                  <span class="skeleton skeleton--text" style="width: 70%"></span>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="attention-error">
            <span class="state-icon" appIcon="TriangleAlert" [size]="20"></span>
            <p>{{ 'dashboard.attentionError' | translate }}</p>
            <button class="btn btn--ghost btn--sm" type="button" (click)="retry.emit()">
              <span appIcon="RefreshCw" [size]="14"></span>{{ 'dashboard.retry' | translate }}
            </button>
          </div>
        } @else if (items().length === 0) {
          <div class="attention-clean">
            <span class="clean-check" appIcon="CircleCheck" [size]="28"></span>
            <strong>{{ 'dashboard.allGood' | translate }}</strong>
            <p>{{ 'dashboard.allGoodDesc' | translate }}</p>
          </div>
        } @else {
          <ul class="attention-list">
            @for (item of items(); track item.id) {
              <li class="attention-item" [class.is-critical]="item.severity === 'critical'">
                <span class="attention-dot" [class.critical]="item.severity === 'critical'"></span>
                <span class="attention-icon" [appIcon]="iconFor(item)" [size]="18"></span>
                <div class="attention-body">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.description }}</span>
                </div>
                <a class="attention-link" [routerLink]="item.link">
                  {{ 'dashboard.view' | translate }}
                  <span appIcon="ArrowRight" [size]="14"></span>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: [`
    .attention-card { border-left: 3px solid var(--line); }
    .attention-card.has-issues { border-left-color: var(--warn); }
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--warn-soft); color: var(--warn); flex: 0 0 auto; }
    .head-icon.is-clean { background: var(--success-soft); color: var(--success); }
    .head-title h2 { font-size: 16px; }
    .head-title p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

    .attention-clean { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6) var(--space-4); text-align: center; }
    .clean-check { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 999px; background: var(--success-soft); color: var(--success); border: 1px solid var(--success-line); }
    .attention-clean strong { font-size: 15px; color: var(--ink-strong); }
    .attention-clean p { margin: 0; color: var(--muted); font-size: 13px; max-width: 38ch; }

    .attention-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .attention-item {
      display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface-soft);
      transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .attention-item:hover { border-color: var(--line-strong); background: var(--surface); }
    .attention-item.is-critical { border-color: var(--danger-line); background: var(--danger-soft); }
    .attention-item.is-critical:hover { border-color: var(--danger); }
    .attention-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--warn); flex: 0 0 auto; }
    .attention-dot.critical { background: var(--danger); }
    .attention-icon { color: var(--warn); display: inline-flex; }
    .attention-item.is-critical .attention-icon { color: var(--danger); }
    .attention-body { display: grid; gap: 1px; min-width: 0; }
    .attention-body strong { font-size: 14px; color: var(--ink-strong); }
    .attention-body span { font-size: 13px; color: var(--muted); }
    .attention-link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--brand-ink); white-space: nowrap; }
    .attention-link:hover { text-decoration: underline; }

    .attention-skeletons { display: grid; gap: var(--space-2); }
    .attention-skel { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); }
    .attention-skel-body { display: grid; gap: 6px; flex: 1; }

    .attention-error { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); text-align: center; }
    .attention-error .state-icon { color: var(--danger); }
    .attention-error p { margin: 0; color: var(--muted); font-size: 13px; }

    @media (max-width: 640px) {
      .attention-item { grid-template-columns: auto 1fr; grid-template-areas: "dot body" "icon link"; }
      .attention-dot { grid-area: dot; }
      .attention-icon { display: none; }
      .attention-body { grid-area: body; }
      .attention-link { grid-area: link; justify-self: start; }
    }
  `]
})
export class AttentionPanelComponent {
  readonly items = input<AttentionItem[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();
  readonly skeletons = [1, 2, 3];

  criticalCount() {
    return this.items().filter((i) => i.severity === 'critical').length;
  }

  iconFor(item: AttentionItem): AppIconName {
    switch (item.kind) {
      case 'low-stock': return 'Boxes';
      case 'vehicle-service': return 'Wrench';
      case 'inspection-expired':
      case 'inspection-soon': return 'ShieldAlert';
      case 'insurance-expired':
      case 'insurance-soon': return 'ShieldAlert';
      default: return 'TriangleAlert';
    }
  }
}
