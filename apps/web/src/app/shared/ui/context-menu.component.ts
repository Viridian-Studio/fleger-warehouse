import {
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { AppIconName, IconDirective } from './icon.directive';

export interface ContextMenuItem {
  /** Value emitted on `select`. */
  id: string;
  label: string;
  icon?: AppIconName;
  /** Right aligned hint, e.g. a shortcut or a short status. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this entry. */
  separatorBefore?: boolean;
}

/**
 * Right-click menu anchored to viewport coordinates. The parent owns the open
 * state: render it inside an `@if` and pass the pointer position.
 */
@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div
      class="context-menu"
      role="menu"
      [style.left.px]="left()"
      [style.top.px]="top()"
      (click)="$event.stopPropagation()"
      (contextmenu)="$event.preventDefault()"
    >
      @if (heading()) {
        <div class="context-menu-heading" title="{{ heading() }}">{{ heading() }}</div>
      }
      @for (item of items(); track item.id) {
        @if (item.separatorBefore) {
          <div class="context-menu-separator"></div>
        }
        <button
          class="context-menu-item"
          type="button"
          role="menuitem"
          [class.is-danger]="item.danger"
          [disabled]="item.disabled"
          (click)="pick(item)"
        >
          @if (item.icon) {
            <span class="context-menu-icon" [appIcon]="item.icon" [size]="15"></span>
          } @else {
            <span class="context-menu-icon"></span>
          }
          <span class="context-menu-label">{{ item.label }}</span>
          @if (item.hint) {
            <small class="context-menu-hint">{{ item.hint }}</small>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 120;
      }

      .context-menu {
        position: fixed;
        min-width: 232px;
        max-width: 320px;
        padding: 6px;
        display: grid;
        gap: 1px;
        background: var(--elevated);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow-pop);
        animation: context-menu-in var(--dur-fast) var(--ease-out);
      }

      @keyframes context-menu-in {
        from {
          opacity: 0;
          transform: scale(0.97);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .context-menu-heading {
        padding: 6px 10px 8px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .context-menu-item {
        display: grid;
        grid-template-columns: 18px 1fr auto;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        padding: 7px 10px;
        border: 0;
        border-radius: var(--radius-xs);
        background: transparent;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease);
      }

      .context-menu-item:hover:not(:disabled),
      .context-menu-item:focus-visible {
        background: var(--surface-hover);
        outline: none;
      }

      .context-menu-item:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .context-menu-item.is-danger {
        color: var(--danger);
      }

      .context-menu-item.is-danger:hover:not(:disabled) {
        background: var(--danger-soft);
      }

      .context-menu-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
      }

      .context-menu-item.is-danger .context-menu-icon {
        color: var(--danger);
      }

      .context-menu-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .context-menu-hint {
        color: var(--muted-soft);
        font-size: 11px;
      }

      .context-menu-separator {
        height: 1px;
        margin: 4px 6px;
        background: var(--line);
      }
    `
  ]
})
export class ContextMenuComponent {
  readonly x = input(0);
  readonly y = input(0);
  readonly heading = input('');
  readonly items = input<ContextMenuItem[]>([]);
  readonly select = output<string>();
  readonly close = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  readonly left = signal(0);
  readonly top = signal(0);

  constructor() {
    this.left.set(this.x());
    this.top.set(this.y());
    // Measure once the menu is in the DOM so it can flip near the viewport edge.
    afterNextRender(() => this.keepInViewport());
  }

  @HostListener('click')
  onBackdropClick() {
    this.close.emit();
  }

  @HostListener('contextmenu', ['$event'])
  onBackdropContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close.emit();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange() {
    this.close.emit();
  }

  pick(item: ContextMenuItem) {
    if (item.disabled) return;
    this.select.emit(item.id);
    this.close.emit();
  }

  private keepInViewport() {
    const menu = (this.host.nativeElement as HTMLElement).querySelector('.context-menu');
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const margin = 8;
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;

    this.left.set(Math.max(margin, Math.min(this.x(), maxLeft)));
    this.top.set(Math.max(margin, Math.min(this.y(), maxTop)));
  }
}
