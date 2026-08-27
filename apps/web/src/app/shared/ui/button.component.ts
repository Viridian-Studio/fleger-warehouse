import { Component, input } from '@angular/core';
import { IconDirective, AppIconName } from './icon.directive';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="spinner" [class.spinner--lg]="size() === 'lg'" [attr.aria-label]="label()" role="status"></span>`,
  styles: [':host { display: inline-flex; }']
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'lg'>('sm');
  readonly label = input('Loading');
}

/** Button with built-in loading state and optional leading icon. */
@Component({
  selector: 'button[appButton]',
  standalone: true,
  imports: [IconDirective],
  template: `
    @if (loading()) {
      <span class="spinner" aria-hidden="true"></span>
    } @else {
      @if (icon(); as i) {
        <span [appIcon]="i" [size]="iconSize()"></span>
      }
      <ng-content></ng-content>
    }
  `,
  host: {
    class: 'btn',
    '[class.btn--primary]': 'variant() === "primary"',
    '[class.btn--secondary]': 'variant() === "secondary"',
    '[class.btn--ghost]': 'variant() === "ghost"',
    '[class.btn--outline]': 'variant() === "outline"',
    '[class.btn--danger]': 'variant() === "danger"',
    '[class.btn--subtle]': 'variant() === "subtle"',
    '[class.btn--loading]': 'loading()'
  }
})
export class ButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'subtle'>('primary');
  readonly icon = input<AppIconName | null>(null);
  readonly loading = input(false);
  readonly iconSize = input(16);
}
