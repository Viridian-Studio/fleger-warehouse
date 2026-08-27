import { Component, HostListener, input, output } from '@angular/core';
import { IconDirective } from './icon.directive';
import { TooltipDirective } from './tooltip.directive';

/**
 * Lightweight modal dialog. Renders a backdrop, supports Escape to close
 * and an optional close button. Content is projected into the body.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconDirective, TooltipDirective],
  template: `
    <div class="modal-backdrop" (click)="onBackdrop($event)">
      <div class="modal modal--{{ size() }}" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        @if (title() || closable()) {
          <div class="modal-head">
            <div class="modal-titles">
              @if (title()) {
                <h2>{{ title() }}</h2>
              }
              @if (description()) {
                <p>{{ description() }}</p>
              }
              <ng-content select="[slot=head]"></ng-content>
            </div>
            @if (closable()) {
              <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Close" (click)="close.emit()" [attr.aria-label]="'Close'">
                <span appIcon="X" [size]="18"></span>
              </button>
            }
          </div>
        }
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <ng-content select="[slot=footer]"></ng-content>
      </div>
    </div>
  `
})
export class ModalComponent {
  readonly title = input('');
  readonly description = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closable = input(true);
  readonly closeOnBackdrop = input(true);
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.closable()) this.close.emit();
  }

  onBackdrop(event: MouseEvent) {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) this.close.emit();
  }
}
