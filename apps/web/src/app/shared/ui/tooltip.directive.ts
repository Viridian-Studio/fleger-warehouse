import { Directive, ElementRef, HostListener, inject, input, OnDestroy, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  readonly appTooltip = input<string>('');
  readonly appTooltipDelay = input(450);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private tooltip: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter')
  onEnter() {
    const text = this.appTooltip();
    if (!text) return;
    this.timer = setTimeout(() => this.show(text), this.appTooltipDelay());
  }

  @HostListener('mouseleave')
  onLeave() {
    this.clearTimer();
    this.hide();
  }

  @HostListener('focus')
  onFocus() {
    const text = this.appTooltip();
    if (!text) return;
    this.show(text);
  }

  @HostListener('blur')
  onBlur() {
    this.hide();
  }

  ngOnDestroy() {
    this.clearTimer();
    this.hide();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private show(text: string) {
    this.hide();
    const el = this.renderer.createElement('div') as HTMLElement;
    el.className = 'tooltip';
    el.textContent = text;
    this.renderer.appendChild(document.body, el);
    this.tooltip = el;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = el.getBoundingClientRect();
    const top = rect.top - tipRect.height - 8;
    el.style.left = `${Math.max(8, rect.left + rect.width / 2 - tipRect.width / 2)}px`;
    el.style.top = `${top < 8 ? rect.bottom + 8 : top}px`;
  }

  private hide() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}
