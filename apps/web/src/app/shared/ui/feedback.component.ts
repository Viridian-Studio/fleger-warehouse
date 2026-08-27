import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective, AppIconName } from './icon.directive';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div class="empty-state">
      <span class="empty-icon" [appIcon]="icon()" [size]="24"></span>
      @if (title()) {
        <h3>{{ title() }}</h3>
      }
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  readonly icon = input<AppIconName>('Inbox');
  readonly title = input('');
  readonly description = input('');
}

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div class="alert alert--{{ variant() }}">
      <span class="alert-icon" [appIcon]="iconFor()" [size]="18"></span>
      <div class="alert-body">
        @if (title()) {
          <strong>{{ title() }}</strong>
        }
        <p><ng-content></ng-content></p>
      </div>
      <ng-content select="[slot=action]"></ng-content>
    </div>
  `
})
export class AlertComponent {
  readonly variant = input<'success' | 'info' | 'warn' | 'error'>('info');
  readonly title = input('');

  iconFor(): 'CircleCheck' | 'Info' | 'TriangleAlert' | 'CircleAlert' {
    switch (this.variant()) {
      case 'success': return 'CircleCheck';
      case 'warn': return 'TriangleAlert';
      case 'error': return 'CircleAlert';
      default: return 'Info';
    }
  }
}

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [IconDirective, RouterLink],
  template: `
    @if (loading()) {
      <article class="metric-card is-skeleton" aria-hidden="true">
        <span class="metric-icon skeleton skeleton--circle" style="width:40px;height:40px"></span>
        <div class="metric-body">
          <span class="skeleton skeleton--text" style="width: 60%"></span>
          <span class="skeleton skeleton--line" style="width: 40%; height: 26px"></span>
          <span class="skeleton skeleton--text" style="width: 50%"></span>
        </div>
      </article>
    } @else if (link(); as l) {
      <a class="metric-card" [routerLink]="l" [class.tone-warn]="tone() === 'warn'" [class.tone-info]="tone() === 'info'" [class.tone-danger]="tone() === 'danger'" [class.tone-success]="tone() === 'success'">
        <span class="metric-icon" [appIcon]="icon()" [size]="20"></span>
        <div class="metric-body">
          <span class="metric-label">{{ label() }}</span>
          <strong class="metric-value">{{ value() }}</strong>
          @if (hint()) {
            <span class="metric-hint" [class.is-warn]="tone() === 'warn'" [class.is-danger]="tone() === 'danger'" [class.is-success]="tone() === 'success'">{{ hint() }}</span>
          }
        </div>
        <span class="metric-arrow" appIcon="ArrowRight" [size]="16"></span>
      </a>
    } @else {
      <article class="metric-card" [class.tone-warn]="tone() === 'warn'" [class.tone-info]="tone() === 'info'" [class.tone-danger]="tone() === 'danger'" [class.tone-success]="tone() === 'success'">
        <span class="metric-icon" [appIcon]="icon()" [size]="20"></span>
        <div class="metric-body">
          <span class="metric-label">{{ label() }}</span>
          <strong class="metric-value">{{ value() }}</strong>
          @if (hint()) {
            <span class="metric-hint" [class.is-warn]="tone() === 'warn'" [class.is-danger]="tone() === 'danger'" [class.is-success]="tone() === 'success'">{{ hint() }}</span>
          }
        </div>
        @if (trend(); as t) {
          <span class="metric-trend" [class.up]="t.direction === 'up'" [class.down]="t.direction === 'down'">
            <span [appIcon]="t.direction === 'up' ? 'TrendingUp' : 'TrendingDown'" [size]="14"></span>
            {{ t.value }}
          </span>
        }
      </article>
    }
  `,
  styles: [`
    .metric-card {
      display: grid;
      grid-template-columns: 40px 1fr auto;
      grid-template-areas: "icon body arrow" "icon trend arrow";
      gap: 2px var(--space-3);
      align-items: center;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      padding: var(--space-4);
      transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
    }
    a.metric-card { text-decoration: none; color: inherit; cursor: pointer; }
    .metric-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-1px); }
    .metric-card.is-skeleton:hover { transform: none; border-color: var(--line); box-shadow: var(--shadow-sm); }
    .metric-icon {
      grid-area: icon;
      align-self: start;
      display: grid; place-items: center;
      width: 40px; height: 40px;
      border-radius: var(--radius-sm);
      background: var(--brand-soft); color: var(--brand-ink);
      border: 1px solid transparent;
    }
    .metric-body { grid-area: body; display: grid; gap: 2px; min-width: 0; }
    .metric-label { color: var(--muted); font-size: 13px; font-weight: 500; }
    .metric-value { font-size: 26px; font-weight: 700; line-height: 1.1; color: var(--ink-strong); letter-spacing: -0.02em; }
    .metric-hint { color: var(--muted); font-size: 12px; }
    .metric-hint.is-warn { color: var(--warn); }
    .metric-hint.is-danger { color: var(--danger); }
    .metric-hint.is-success { color: var(--success); }
    .metric-arrow { grid-area: arrow; color: var(--muted-soft); align-self: center; transition: transform var(--dur) var(--ease), color var(--dur) var(--ease); }
    a.metric-card:hover .metric-arrow { color: var(--brand-ink); transform: translateX(2px); }
    .metric-trend {
      grid-area: trend;
      display: inline-flex; align-items: center; gap: 4px;
      width: fit-content;
      font-size: 12px; font-weight: 600;
      color: var(--muted);
    }
    .metric-trend.up { color: var(--success); }
    .metric-trend.down { color: var(--danger); }
    .tone-warn .metric-icon { background: var(--warn-soft); color: var(--warn); }
    .tone-info .metric-icon { background: var(--info-soft); color: var(--info); }
    .tone-danger .metric-icon { background: var(--danger-soft); color: var(--danger); }
    .tone-success .metric-icon { background: var(--success-soft); color: var(--success); }
  `]
})
export class MetricCardComponent {
  readonly icon = input<AppIconName>('Package');
  readonly label = input('');
  readonly value = input<string | number>('');
  readonly hint = input('');
  readonly tone = input<'neutral' | 'warn' | 'info' | 'danger' | 'success'>('neutral');
  readonly trend = input<{ direction: 'up' | 'down'; value: string } | null>(null);
  readonly link = input<string | null>(null);
  readonly loading = input(false);
}
