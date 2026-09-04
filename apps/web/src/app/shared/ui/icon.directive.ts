import { Directive, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Building,
  Building2,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Clock,
  Command,
  Copy,
  CornerDownLeft,
  CreditCard,
  Dot,
  Eye,
  Funnel,
  Globe,
  Hash,
  Inbox,
  Info,
  Key,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListFilter,
  FolderTree,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Monitor,
  Moon,
  MoonStar,
  Package,
  PackageCheck,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plug,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
  Unplug,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
  X,
  type IconNode
} from 'lucide';

type IconAttrs = Record<string, string | number | undefined>;
const ICONS = {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Building,
  Building2,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Clock,
  Command,
  Copy,
  CornerDownLeft,
  CreditCard,
  Dot,
  Eye,
  Funnel,
  Globe,
  Hash,
  Inbox,
  Info,
  Key,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListFilter,
  FolderTree,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Monitor,
  Moon,
  MoonStar,
  Package,
  PackageCheck,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plug,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
  Unplug,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
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
