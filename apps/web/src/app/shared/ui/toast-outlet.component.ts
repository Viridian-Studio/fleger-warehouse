import { Component, inject } from '@angular/core';
import { IconDirective, AppIconName } from './icon.directive';
import { ToastService, ToastType } from './toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toasts.messages(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" role="status">
          <span class="toast-icon" [appIcon]="iconFor(toast.type)" [size]="18"></span>
          <div class="toast-body">
            @if (toast.title) {
              <strong>{{ toast.title }}</strong>
            }
            <span>{{ toast.message }}</span>
          </div>
          <button class="toast-close" type="button" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">
            <span appIcon="X" [size]="14"></span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 70;
      display: grid;
      gap: 10px;
      width: min(380px, calc(100vw - 32px));
    }
    .toast {
      display: grid;
      grid-template-columns: 20px 1fr auto;
      gap: 12px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-left: 3px solid var(--muted);
      border-radius: var(--radius-sm);
      background: var(--elevated);
      color: var(--ink);
      padding: 12px 12px 12px 14px;
      box-shadow: var(--shadow-lg);
      animation: toast-in var(--dur-slow) var(--ease-out);
    }
    .toast--success { border-left-color: var(--success); }
    .toast--error { border-left-color: var(--danger); }
    .toast--warning { border-left-color: var(--warn); }
    .toast--info { border-left-color: var(--info); }
    .toast-icon { display: inline-flex; margin-top: 1px; }
    .toast--success .toast-icon { color: var(--success); }
    .toast--error .toast-icon { color: var(--danger); }
    .toast--warning .toast-icon { color: var(--warn); }
    .toast--info .toast-icon { color: var(--info); }
    .toast-body { display: grid; gap: 2px; min-width: 0; }
    .toast-body strong { font-size: 13px; color: var(--ink-strong); }
    .toast-body span { font-size: 13px; color: var(--ink); }
    .toast-close {
      display: inline-grid; place-items: center;
      width: 22px; height: 22px;
      border: 0; border-radius: var(--radius-xs);
      background: transparent; color: var(--muted);
    }
    .toast-close:hover { background: var(--surface-hover); color: var(--ink); }
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @media (max-width: 640px) {
      .toast-stack { right: 12px; bottom: 12px; left: 12px; width: auto; }
    }
  `]
})
export class ToastOutletComponent {
  readonly toasts = inject(ToastService);

  iconFor(type: ToastType): AppIconName {
    switch (type) {
      case 'success': return 'CircleCheck';
      case 'error': return 'CircleAlert';
      case 'warning': return 'TriangleAlert';
      default: return 'Info';
    }
  }
}
