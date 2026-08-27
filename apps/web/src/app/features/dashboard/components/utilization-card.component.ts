import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective, AppIconName } from '../../../shared/ui/icon.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export interface BreakdownItem {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'warn' | 'danger' | 'success' | 'muted';
}

@Component({
  selector: 'app-utilization-card',
  standalone: true,
  imports: [IconDirective, RouterLink, TranslatePipe],
  template: `
    <a class="card util-card" [routerLink]="link()">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" [appIcon]="icon()" [size]="18"></span>
          <div>
            <h2>{{ title() | translate }}</h2>
            <p>{{ percent() }}{{ subtitleTpl() | translate }}</p>
          </div>
        </div>
        <span class="badge" [class.badge--brand]="tone() === 'brand'" [class.badge--info]="tone() === 'info'" [class.badge--warn]="tone() === 'warn'" [class.badge--danger]="tone() === 'danger'">{{ percent() }}%</span>
      </div>
      <div class="card-body">
        <div class="progress-track" [class.blue]="tone() === 'info'" [class.warn]="tone() === 'warn'" [class.danger]="tone() === 'danger'">
          <span [style.width.%]="percent()"></span>
        </div>
        <div class="breakdown">
          @for (item of breakdown(); track item.label) {
            <span class="breakdown-item">
              <span class="legend-dot" [class.brand]="item.tone === 'brand'" [class.info]="item.tone === 'info'" [class.warn]="item.tone === 'warn'" [class.danger]="item.tone === 'danger'" [class.success]="item.tone === 'success'"></span>
              <strong>{{ item.value }}</strong> {{ item.label }}
            </span>
          }
        </div>
      </div>
    </a>
  `,
  styles: [`
    .util-card { display: block; text-decoration: none; color: inherit; cursor: pointer; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease); }
    .util-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-1px); }
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); flex: 0 0 auto; }
    .head-title h2 { font-size: 16px; }
    .head-title p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

    .breakdown { display: flex; gap: var(--space-5); margin-top: var(--space-4); flex-wrap: wrap; }
    .breakdown-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
    .breakdown-item strong { color: var(--ink-strong); font-weight: 700; }
    .legend-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--brand); }
    .legend-dot.info { background: var(--accent-600); }
    .legend-dot.warn { background: var(--warn); }
    .legend-dot.danger { background: var(--danger); }
    .legend-dot.success { background: var(--success); }

    @media (max-width: 640px) {
      .breakdown { gap: var(--space-3); }
    }
  `]
})
export class UtilizationCardComponent {
  readonly title = input('');
  readonly subtitleTpl = input('');
  readonly icon = input<AppIconName>('Boxes');
  readonly percent = input(0);
  readonly tone = input<'brand' | 'info' | 'warn' | 'danger'>('brand');
  readonly link = input('/inventory');
  readonly breakdown = input<BreakdownItem[]>([]);
}
