import { Component, input, output } from '@angular/core';
import { IconDirective, AppIconName } from './icon.directive';
import { ModalComponent } from './modal.component';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: AppIconName;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [IconDirective, ModalComponent],
  template: `
    <app-modal
      [title]="options().title"
      [description]="options().message"
      size="sm"
      [closable]="!loading()"
      [closeOnBackdrop]="!loading()"
      (close)="cancel.emit()"
    >
      <div class="confirm-body">
        @if (options().icon) {
          <span class="confirm-icon" [class.danger]="options().danger" [appIcon]="options().icon!" [size]="22"></span>
        }
        <p>{{ options().message }}</p>
      </div>
      <div slot="footer" class="modal-foot">
        <button class="btn btn--ghost" type="button" [disabled]="loading()" (click)="cancel.emit()">
          {{ options().cancelLabel || 'Cancel' }}
        </button>
        <button
          class="btn"
          [class.btn--primary]="!options().danger"
          [class.btn--danger]="options().danger"
          type="button"
          [disabled]="loading()"
          (click)="confirm.emit()"
        >
          @if (loading()) {
            <span class="spinner" aria-hidden="true"></span>
          }
          {{ options().confirmLabel || (options().danger ? 'Delete' : 'Confirm') }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .confirm-body { display: flex; gap: var(--space-3); align-items: flex-start; }
    .confirm-icon {
      display: grid; place-items: center;
      width: 44px; height: 44px; flex: 0 0 auto;
      border-radius: var(--radius);
      background: var(--brand-soft); color: var(--brand-ink);
    }
    .confirm-icon.danger { background: var(--danger-soft); color: var(--danger); }
    .confirm-body p { margin: 0; color: var(--muted); line-height: 1.5; }
  `]
})
export class ConfirmDialogComponent {
  readonly options = input.required<ConfirmOptions>();
  readonly loading = input(false);
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
