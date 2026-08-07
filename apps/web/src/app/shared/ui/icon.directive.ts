import { Directive, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';
import {
  Bell,
  Boxes,
  Building2,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  CreditCard,
  ChevronDown,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  type IconNode
} from 'lucide';

type IconAttrs = Record<string, string | number | undefined>;
const ICONS = {
  Bell,
  Boxes,
  Building2,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  CreditCard,
  ChevronDown,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X
} satisfies Record<string, IconNode>;

export type AppIconName = keyof typeof ICONS;

@Directive({
  selector: '[appIcon]',
  standalone: true
})
export class IconDirective implements OnChanges {
  @Input({ alias: 'appIcon', required: true }) name!: AppIconName;
  @Input() size = 18;
  @Input() strokeWidth = 2;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {}

  ngOnChanges() {
    const icon = ICONS[this.name];
    const element = this.host.nativeElement;
    element.replaceChildren();

    if (!icon) return;

    const svg = this.renderer.createElement('svg', 'svg');
    this.set(svg, {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(this.size),
      height: String(this.size),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(this.strokeWidth),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });

    for (const [tag, attrs] of icon) {
      const child = this.renderer.createElement(tag, 'svg');
      this.set(child, attrs);
      this.renderer.appendChild(svg, child);
    }

    this.renderer.appendChild(element, svg);
  }

  private set(element: Element, attrs: IconAttrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) this.renderer.setAttribute(element, key, String(value));
    }
  }
}
