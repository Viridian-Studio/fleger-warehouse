import { Component, ElementRef, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconDirective, AppIconName } from './icon.directive';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: AppIconName;
  hint?: string;
  action?: () => void;
  route?: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [IconDirective],
  template: `
    <div class="cmd-backdrop" (click)="close.emit()">
      <div class="cmd" role="dialog" aria-modal="true" aria-label="Command palette" (click)="$event.stopPropagation()">
        <div class="cmd-input">
          <span class="cmd-search-icon" [appIcon]="'Search'" [size]="18"></span>
          <input
            #queryInput
            type="text"
            [value]="query()"
            (input)="onInput($any($event.target).value)"
            [placeholder]="placeholder()"
            aria-label="Search"
            autocomplete="off"
          />
          <span class="kbd">Esc</span>
        </div>

        @if (filtered().length === 0) {
          <div class="cmd-empty">
            <span [appIcon]="'Search'" [size]="22"></span>
            <p>No results for "{{ query() }}"</p>
          </div>
        } @else {
          <div class="cmd-list" role="listbox">
            @for (group of grouped(); track group.name) {
              <div class="cmd-group">
                <div class="cmd-group-label">{{ group.name }}</div>
                @for (item of group.items; track item.id) {
                  <button
                    class="cmd-item"
                    [class.active]="activeId() === item.id"
                    (mouseenter)="activeId.set(item.id)"
                    (click)="run(item)"
                    role="option"
                    [attr.aria-selected]="activeId() === item.id"
                  >
                    @if (item.icon) {
                      <span class="cmd-item-icon" [appIcon]="item.icon" [size]="16"></span>
                    }
                    <span class="cmd-item-label">{{ item.label }}</span>
                    @if (item.hint) {
                      <span class="cmd-item-hint">{{ item.hint }}</span>
                    }
                  </button>
                }
              </div>
            }
          </div>
        }
        <div class="cmd-foot">
          <span><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span>
          <span><span class="kbd">↵</span> open</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cmd-backdrop {
      position: fixed; inset: 0; z-index: 75;
      background: var(--overlay); backdrop-filter: blur(2px);
      display: flex; justify-content: center; align-items: flex-start;
      padding-top: 12vh;
      animation: fade-in var(--dur) var(--ease);
    }
    .cmd {
      width: 100%; max-width: 560px; margin: 0 var(--space-5);
      background: var(--elevated);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: modal-in var(--dur-slow) var(--ease-out);
    }
    .cmd-input {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--line);
    }
    .cmd-search-icon { color: var(--muted); display: inline-flex; }
    .cmd-input input {
      flex: 1; border: 0; outline: 0; background: transparent;
      font-size: 16px; color: var(--ink); height: 32px; padding: 0;
    }
    .cmd-list { max-height: 360px; overflow: auto; padding: var(--space-2); }
    .cmd-group { display: grid; gap: 2px; }
    .cmd-group + .cmd-group { margin-top: var(--space-2); }
    .cmd-group-label {
      padding: var(--space-2) var(--space-3);
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--muted-soft);
    }
    .cmd-item {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%; text-align: left;
      border: 0; border-radius: var(--radius-sm);
      background: transparent; color: var(--ink);
      padding: var(--space-2) var(--space-3);
      font-size: 14px;
    }
    .cmd-item.active { background: var(--brand-soft); color: var(--brand-ink); }
    .cmd-item-icon { color: var(--muted); display: inline-flex; }
    .cmd-item.active .cmd-item-icon { color: var(--brand-ink); }
    .cmd-item-label { flex: 1; min-width: 0; }
    .cmd-item-hint { color: var(--muted-soft); font-size: 12px; }
    .cmd-empty {
      display: grid; place-items: center; gap: var(--space-2);
      padding: var(--space-8) var(--space-5); color: var(--muted); text-align: center;
    }
    .cmd-empty p { margin: 0; }
    .cmd-foot {
      display: flex; gap: var(--space-4); align-items: center;
      padding: var(--space-2) var(--space-4);
      border-top: 1px solid var(--line);
      font-size: 12px; color: var(--muted);
    }
    .cmd-foot span { display: inline-flex; align-items: center; gap: 4px; }
  `]
})
export class CommandPaletteComponent {
  readonly items = input<CommandItem[]>([]);
  readonly searchResults = input<CommandItem[]>([]);
  readonly placeholder = input('Search records…');
  readonly close = output<void>();
  readonly queryChange = output<string>();

  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly query = signal('');
  readonly activeId = signal<string>('');
  readonly open = signal(false);

  onInput(value: string) {
    this.query.set(value);
    this.queryChange.emit(value);
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const navItems = this.items();
    const searchItems = this.searchResults();

    if (!q) return navItems;

    // Combine nav items (filtered by label) + API search results
    const filteredNav = navItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    );

    // Deduplicate by id
    const seen = new Set(filteredNav.map((i) => i.id));
    const uniqueSearch = searchItems.filter((i) => !seen.has(i.id));

    return [...uniqueSearch, ...filteredNav];
  });

  readonly grouped = computed(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of this.filtered()) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  constructor() {
    effect(() => {
      const first = this.filtered()[0];
      this.activeId.set(first?.id ?? '');
    });
  }

  @HostListener('document:keydown.arrowdown', ['$event'])
  onDown(event: Event) {
    if (!this.host.nativeElement.isConnected) return;
    event.preventDefault();
    this.move(1);
  }

  @HostListener('document:keydown.arrowup', ['$event'])
  onUp(event: Event) {
    if (!this.host.nativeElement.isConnected) return;
    event.preventDefault();
    this.move(-1);
  }

  @HostListener('document:keydown.enter', ['$event'])
  onEnter(event: Event) {
    if (!this.host.nativeElement.isConnected) return;
    event.preventDefault();
    const item = this.filtered().find((i) => i.id === this.activeId());
    if (item) this.run(item);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.host.nativeElement.isConnected) this.close.emit();
  }

  private move(direction: 1 | -1) {
    const list = this.filtered();
    if (!list.length) return;
    const index = list.findIndex((i) => i.id === this.activeId());
    const next = (index + direction + list.length) % list.length;
    this.activeId.set(list[next].id);
  }

  run(item: CommandItem) {
    if (item.route) void this.router.navigateByUrl(item.route);
    item.action?.();
    this.close.emit();
  }
}
