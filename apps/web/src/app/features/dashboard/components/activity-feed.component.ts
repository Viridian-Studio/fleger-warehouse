import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective, AppIconName } from '../../../shared/ui/icon.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ActivityEntry } from '../dashboard.types';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [DatePipe, IconDirective, RouterLink, TranslatePipe],
  template: `
    <section class="card">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" appIcon="Clock" [size]="18"></span>
          <h2>{{ 'dashboard.recentActivity' | translate }}</h2>
        </div>
        <a class="head-link" routerLink="/audit-log">
          {{ 'dashboard.allActivity' | translate }}
          <span appIcon="ArrowRight" [size]="14"></span>
        </a>
      </div>
      <div class="card-body">
        @if (loading()) {
          <div class="feed-skeletons">
            @for (i of skeletons; track i) {
              <div class="feed-skel">
                <span class="skeleton skeleton--circle" style="width:28px;height:28px"></span>
                <div class="feed-skel-body">
                  <span class="skeleton skeleton--text" style="width: 50%"></span>
                  <span class="skeleton skeleton--text" style="width: 30%"></span>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="feed-error">
            <span class="state-icon" appIcon="TriangleAlert" [size]="20"></span>
            <p>{{ 'dashboard.activityError' | translate }}</p>
            <button class="btn btn--ghost btn--sm" type="button" (click)="retry.emit()">
              <span appIcon="RefreshCw" [size]="14"></span>{{ 'dashboard.retry' | translate }}
            </button>
          </div>
        } @else if (entries().length === 0) {
          <div class="feed-empty">
            <span class="empty-icon" appIcon="ScrollText" [size]="22"></span>
            <p>{{ 'dashboard.activityEmpty' | translate }}</p>
          </div>
        } @else {
          <ul class="feed-list">
            @for (entry of entries(); track entry._id) {
              <li class="feed-item">
                <span class="feed-dot"></span>
                <span class="feed-icon" [appIcon]="iconFor(entry)" [size]="16"></span>
                <div class="feed-body">
                  <strong>{{ entry.actorName }}</strong>
                  <span>{{ actionLabel(entry) }}</span>
                </div>
                <small class="feed-time">{{ entry.timestamp | date: 'short' }}</small>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: [`
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--info-soft); color: var(--info); flex: 0 0 auto; }
    .head-title h2 { font-size: 16px; }
    .head-link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--brand-ink); }
    .head-link:hover { text-decoration: underline; }

    .feed-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .feed-item {
      display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      transition: background var(--dur-fast) var(--ease);
    }
    .feed-item:hover { background: var(--surface-soft); }
    .feed-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--brand); flex: 0 0 auto; }
    .feed-icon { color: var(--muted); display: inline-flex; }
    .feed-body { display: grid; gap: 1px; min-width: 0; }
    .feed-body strong { font-size: 13px; color: var(--ink-strong); }
    .feed-body span { font-size: 13px; color: var(--muted); }
    .feed-time { color: var(--muted-soft); font-size: 11px; white-space: nowrap; }

    .feed-empty { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); text-align: center; }
    .feed-empty .empty-icon { color: var(--muted); }
    .feed-empty p { margin: 0; color: var(--muted); font-size: 13px; }

    .feed-error { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); text-align: center; }
    .feed-error .state-icon { color: var(--danger); }
    .feed-error p { margin: 0; color: var(--muted); font-size: 13px; }

    .feed-skeletons { display: grid; gap: var(--space-2); }
    .feed-skel { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); }
    .feed-skel-body { display: grid; gap: 6px; flex: 1; }

    @media (max-width: 640px) {
      .feed-item { grid-template-columns: auto 1fr; grid-template-areas: "dot body" "icon time"; }
      .feed-dot { grid-area: dot; }
      .feed-icon { grid-area: icon; }
      .feed-body { grid-area: body; }
      .feed-time { grid-area: time; justify-self: start; }
    }
  `]
})
export class ActivityFeedComponent {
  readonly entries = input<ActivityEntry[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();
  readonly skeletons = [1, 2, 3, 4, 5];

  iconFor(entry: ActivityEntry): AppIconName {
    const action = entry.action.toLowerCase();
    if (action.includes('create')) return 'Plus';
    if (action.includes('assign') || action.includes('issue')) return 'Send';
    if (action.includes('return')) return 'RotateCcw';
    if (action.includes('delete') || action.includes('remove')) return 'Trash2';
    if (action.includes('update') || action.includes('edit')) return 'Pencil';
    if (action.includes('low_stock')) return 'TriangleAlert';
    if (action.includes('login') || action.includes('auth')) return 'Key';
    return 'CircleDot';
  }

  actionLabel(entry: ActivityEntry): string {
    const entity = this.entityLabel(entry.entityType);
    const verb = this.verbLabel(entry.action);
    return `${verb} · ${entity}`;
  }

  private verbLabel(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('create')) return 'Létrehozva';
    if (a.includes('assign') || a.includes('issue')) return 'Kiadva';
    if (a.includes('return')) return 'Visszavéve';
    if (a.includes('delete') || a.includes('remove')) return 'Törölve';
    if (a.includes('update') || a.includes('edit')) return 'Módosítva';
    if (a.includes('low_stock')) return 'Alacsony készlet';
    if (a.includes('login')) return 'Bejelentkezés';
    return action;
  }

  private entityLabel(entityType: string): string {
    const e = entityType.toLowerCase();
    if (e.includes('inventory')) return 'Készlet';
    if (e.includes('vehicle')) return 'Jármű';
    if (e.includes('employee')) return 'Dolgozó';
    if (e.includes('assignment')) return 'Kiadás';
    if (e.includes('user')) return 'Felhasználó';
    return entityType;
  }
}
