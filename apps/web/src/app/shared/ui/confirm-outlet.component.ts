import { Component, inject } from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmService } from './confirm.service';

/** Global outlet that renders the active confirm dialog from ConfirmService. */
@Component({
  selector: 'app-confirm-outlet',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    @if (dialog(); as d) {
      <app-confirm-dialog
        [options]="d"
        [loading]="d.loading"
        (confirm)="confirm()"
        (cancel)="cancel()"
      />
    }
  `
})
export class ConfirmOutletComponent {
  private readonly service = inject(ConfirmService);
  readonly dialog = this.service.state;

  confirm() {
    this.service.resolve(true);
  }

  cancel() {
    this.service.resolve(false);
  }
}
