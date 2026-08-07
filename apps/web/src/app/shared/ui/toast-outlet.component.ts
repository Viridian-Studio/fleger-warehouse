import { Component, inject } from '@angular/core';
import { IconDirective } from './icon.directive';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toasts.messages(); track toast.id) {
        <button class="toast" [class.success]="toast.type === 'success'" [class.error]="toast.type === 'error'" (click)="toasts.dismiss(toast.id)">
          <span [appIcon]="toast.type === 'error' ? 'CircleAlert' : toast.type === 'success' ? 'CircleCheck' : 'Info'"></span>
          <span>{{ toast.message }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .toast-stack { position: fixed; right: 22px; bottom: 22px; z-index: 40; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
    .toast { display: grid; grid-template-columns: 20px 1fr; gap: 10px; align-items: center; text-align: left; border: 1px solid var(--line); border-radius: 8px; background: white; color: var(--ink); padding: 12px 14px; box-shadow: var(--shadow); }
    .toast.success { border-color: #b7dccf; background: #f2fbf7; }
    .toast.error { border-color: #ffc9c1; background: #fff5f3; }
    @media (max-width: 640px) { .toast-stack { right: 16px; bottom: 16px; } }
  `
})
export class ToastOutletComponent {
  readonly toasts = inject(ToastService);
}
