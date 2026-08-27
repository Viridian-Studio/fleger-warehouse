import { Component, output } from '@angular/core';
import { IconDirective, AppIconName } from '../../../shared/ui/icon.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface QuickAction {
  id: string;
  labelKey: string;
  icon: AppIconName;
  variant: 'primary' | 'secondary' | 'ghost';
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [IconDirective, TranslatePipe],
  template: `
    <section class="card">
      <div class="card-head">
        <div class="head-title">
          <span class="head-icon" appIcon="Sparkles" [size]="18"></span>
          <div>
            <h2>{{ 'dashboard.quickActions' | translate }}</h2>
            <p>{{ 'dashboard.quickActionsDesc' | translate }}</p>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="actions-grid">
          @for (action of actions; track action.id) {
            <button class="action-btn" [class.is-primary]="action.variant === 'primary'" [class.is-secondary]="action.variant === 'secondary'" type="button" (click)="actionClick.emit(action.id)">
              <span class="action-icon" [appIcon]="action.icon" [size]="18"></span>
              <span class="action-label">{{ action.labelKey | translate }}</span>
              <span class="action-arrow" appIcon="ArrowRight" [size]="14"></span>
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .head-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); flex: 0 0 auto; }
    .head-title h2 { font-size: 16px; }
    .head-title p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

    .actions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
    .action-btn {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface-soft); color: var(--ink);
      text-align: left; font-weight: 600; font-size: 14px;
      transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
    }
    .action-btn:hover { border-color: var(--line-strong); background: var(--surface); transform: translateY(-1px); }
    .action-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); flex: 0 0 auto; }
    .action-btn.is-primary .action-icon { background: var(--brand); color: #fff; }
    .action-btn.is-secondary .action-icon { background: var(--accent-600); color: #fff; }
    .action-label { flex: 1; min-width: 0; }
    .action-arrow { color: var(--muted-soft); transition: transform var(--dur) var(--ease), color var(--dur) var(--ease); }
    .action-btn:hover .action-arrow { color: var(--brand-ink); transform: translateX(2px); }
  `]
})
export class QuickActionsComponent {
  readonly actionClick = output<string>();

  readonly actions: QuickAction[] = [
    { id: 'new-inventory', labelKey: 'dashboard.qaNewInventory', icon: 'Boxes', variant: 'primary' },
    { id: 'new-employee', labelKey: 'dashboard.qaNewEmployee', icon: 'UserPlus', variant: 'primary' },
    { id: 'new-vehicle', labelKey: 'dashboard.qaNewVehicle', icon: 'Truck', variant: 'secondary' },
    { id: 'issue-asset', labelKey: 'dashboard.qaIssueAsset', icon: 'Send', variant: 'ghost' },
    { id: 'assign-vehicle', labelKey: 'dashboard.qaAssignVehicle', icon: 'KeyRound', variant: 'ghost' }
  ];
}
