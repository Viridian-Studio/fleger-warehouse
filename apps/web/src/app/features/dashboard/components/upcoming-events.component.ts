import { Component, input, output } from '@angular/core';
import { IconDirective, AppIconName } from '../../../shared/ui/icon.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { UpcomingEvent } from '../dashboard.types';

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [IconDirective, TranslatePipe],
  template: `
    <section class="card">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" appIcon="Calendar" [size]="18"></span>
          <h2>{{ 'dashboard.upcoming' | translate }}</h2>
        </div>
      </div>
      <div class="card-body">
        @if (loading()) {
          <div class="event-skeletons">
            @for (i of skeletons; track i) {
              <div class="event-skel">
                <span class="skeleton skeleton--circle" style="width:28px;height:28px"></span>
                <div class="event-skel-body">
                  <span class="skeleton skeleton--text" style="width: 55%"></span>
                  <span class="skeleton skeleton--text" style="width: 35%"></span>
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="event-error">
            <span class="state-icon" appIcon="TriangleAlert" [size]="20"></span>
            <p>{{ 'dashboard.upcomingError' | translate }}</p>
            <button class="btn btn--ghost btn--sm" type="button" (click)="retry.emit()">
              <span appIcon="RefreshCw" [size]="14"></span>{{ 'dashboard.retry' | translate }}
            </button>
          </div>
        } @else if (events().length === 0) {
          <div class="event-empty">
            <span class="empty-icon" appIcon="Calendar" [size]="22"></span>
            <p>{{ 'dashboard.upcomingEmpty' | translate }}</p>
          </div>
        } @else {
          <ul class="event-list">
            @for (event of events(); track event.id) {
              <li class="event-item" [class.is-critical]="event.severity === 'critical'">
                <span class="event-icon" [appIcon]="iconFor(event)" [size]="16"></span>
                <div class="event-body">
                  <strong>{{ eventLabel(event) }}</strong>
                  <span class="event-vehicle">{{ event.vehicleName }}</span>
                </div>
                <span class="event-when" [class.critical]="event.severity === 'critical'">{{ whenLabel(event) }}</span>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: [`
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--warn-soft); color: var(--warn); flex: 0 0 auto; }
    .head-title h2 { font-size: 16px; }

    .event-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .event-item {
      display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface-soft);
      transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .event-item:hover { border-color: var(--line-strong); background: var(--surface); }
    .event-item.is-critical { border-color: var(--danger-line); background: var(--danger-soft); }
    .event-icon { color: var(--warn); display: inline-flex; }
    .event-item.is-critical .event-icon { color: var(--danger); }
    .event-body { display: grid; gap: 1px; min-width: 0; }
    .event-body strong { font-size: 13px; color: var(--ink-strong); }
    .event-vehicle { font-size: 12px; color: var(--muted); }
    .event-when { font-size: 12px; font-weight: 600; color: var(--warn); white-space: nowrap; }
    .event-when.critical { color: var(--danger); }

    .event-empty { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); text-align: center; }
    .event-empty .empty-icon { color: var(--muted); }
    .event-empty p { margin: 0; color: var(--muted); font-size: 13px; }

    .event-error { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); text-align: center; }
    .event-error .state-icon { color: var(--danger); }
    .event-error p { margin: 0; color: var(--muted); font-size: 13px; }

    .event-skeletons { display: grid; gap: var(--space-2); }
    .event-skel { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); }
    .event-skel-body { display: grid; gap: 6px; flex: 1; }

    @media (max-width: 640px) {
      .event-item { grid-template-columns: auto 1fr; grid-template-areas: "icon body" "icon when"; }
      .event-icon { grid-area: icon; }
      .event-body { grid-area: body; }
      .event-when { grid-area: when; justify-self: start; }
    }
  `]
})
export class UpcomingEventsComponent {
  readonly events = input<UpcomingEvent[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();
  readonly skeletons = [1, 2, 3];

  iconFor(event: UpcomingEvent): AppIconName {
    return event.kind === 'inspection' ? 'ShieldAlert' : 'ShieldCheck';
  }

  eventLabel(event: UpcomingEvent): string {
    return event.kind === 'inspection' ? 'Műszaki vizsga' : 'Biztosítás';
  }

  whenLabel(event: UpcomingEvent): string {
    const d = event.daysUntil;
    if (d < 0) return `${Math.abs(d)} napja lejárt`;
    if (d === 0) return 'Ma';
    if (d === 1) return '1 nap múlva';
    return `${d} nap múlva`;
  }
}
