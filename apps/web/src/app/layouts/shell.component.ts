import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ApplicationDetailsStore } from '../core/application/application-details.store';
import { ApiService } from '../core/api/api.service';
import { AuthStore } from '../core/auth/auth.store';
import { I18nService } from '../core/i18n/i18n.service';
import { TenantStore } from '../core/tenant/tenant.store';
import { ThemeService } from '../core/theme/theme.service';
import { IconDirective, AppIconName } from '../shared/ui/icon.directive';
import { TooltipDirective } from '../shared/ui/tooltip.directive';
import { ToastOutletComponent } from '../shared/ui/toast-outlet.component';
import { ConfirmOutletComponent } from '../shared/ui/confirm-outlet.component';
import { CommandPaletteComponent, CommandItem } from '../shared/ui/command-palette.component';
import { TranslatePipe } from '../shared/pipes/translate.pipe';

interface Notification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NavItem {
  path: string;
  labelKey: string;
  icon: AppIconName;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    DatePipe,
    IconDirective,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ToastOutletComponent,
    ConfirmOutletComponent,
    CommandPaletteComponent,
    TooltipDirective,
    TranslatePipe,
  ],
  template: `
    <div class="shell" [class.collapsed]="collapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">
            <img
              src="/assets/viridian_fox_logo_white.png"
              alt="Viridian Studio"
              (error)="hideBrokenLogo($event)"
            />
          </div>
          <div class="brand-text">
            <strong>{{ applicationDetails().companyName }}</strong>
            <span>v{{ applicationDetails().version }} · {{ applicationDetails().buildName }}</span>
          </div>
        </div>

        <div class="workspace">
          <span class="workspace-label">{{ 'shell.workspace' | translate }}</span>
          <div class="workspace-select">
            <span class="workspace-glyph" [appIcon]="'Building2'" [size]="16"></span>
            <select
              [value]="activeSlug()"
              (change)="switchTenant($event)"
              [title]="'shell.workspace' | translate"
              aria-label="Workspace"
            >
              @for (workspace of tenantStore.workspaces(); track workspace.tenantSlug) {
                <option [value]="workspace.tenantSlug">{{ workspace.tenantSlug }}</option>
              }
            </select>
            <span class="workspace-caret" [appIcon]="'ChevronDown'" [size]="14"></span>
          </div>
        </div>

        <nav class="nav">
          @for (group of navGroups(); track group.label) {
            <div class="nav-group">
              @if (!collapsed()) {
                <div class="nav-group-label">{{ group.label }}</div>
              }
              @for (item of group.items; track item.path) {
                <a
                  class="nav-item"
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  [appTooltip]="collapsed() ? (item.labelKey | translate) : ''"
                >
                  <span class="nav-icon" [appIcon]="item.icon" [size]="18"></span>
                  <span class="nav-label">{{ item.labelKey | translate }}</span>
                </a>
              }
            </div>
          }
        </nav>
      </aside>

      <!-- Main -->
      <main class="main">
        <header class="topbar">
          <button class="icon-btn sidebar-toggle" type="button" (click)="toggleCollapsed()" appTooltip="Toggle sidebar" aria-label="Toggle sidebar">
            <span [appIcon]="collapsed() ? 'PanelLeftOpen' : 'PanelLeftClose'" [size]="18"></span>
          </button>
          <button class="icon-btn mobile-menu" type="button" (click)="mobileOpen.set(true)" aria-label="Open menu">
            <span appIcon="Menu" [size]="20"></span>
          </button>

          <div class="topbar-title">
            <strong>{{ activeLabel() }}</strong>
            <span>{{ activeSlug() || ('shell.noWorkspace' | translate) }}</span>
          </div>

          <button class="search-trigger" type="button" (click)="openPalette()">
            <span class="search-icon" appIcon="Search" [size]="16"></span>
            <span class="search-text">{{ 'shell.search' | translate }}</span>
            <span class="search-kbd"><span class="kbd">⌘</span><span class="kbd">K</span></span>
          </button>

          <div class="topbar-actions">
            <button class="icon-btn" type="button" appTooltip="Toggle theme" (click)="theme.toggle()" aria-label="Toggle theme">
              <span [appIcon]="theme.theme() === 'dark' ? 'Sun' : 'Moon'" [size]="18"></span>
            </button>

            <div class="notifications">
              <button class="icon-btn" type="button" [appTooltip]="'shell.notifications' | translate" (click)="toggleNotifications()">
                <span appIcon="Bell" [size]="18"></span>
                @if (unread() > 0) {
                  <span class="notif-badge">{{ unread() }}</span>
                }
              </button>
              @if (notificationsOpen()) {
                <div class="dropdown notification-menu">
                  <div class="dropdown-head">
                    <strong>{{ 'shell.notifications' | translate }}</strong>
                    <button class="btn--subtle btn--sm" type="button" (click)="notificationsOpen.set(false)">
                      <span appIcon="X" [size]="14"></span>
                    </button>
                  </div>
                  <div class="dropdown-body">
                    @if (notifications().length === 0) {
                      <div class="notif-empty">
                        <span appIcon="Bell" [size]="22"></span>
                        <p>{{ 'shell.noNotifications' | translate }}</p>
                      </div>
                    }
                    @for (n of notifications(); track n._id) {
                      <button class="notification-item" [class.unread]="!n.read" type="button" (click)="markRead(n._id)">
                        <span class="notif-dot" [class.unread]="!n.read"></span>
                        <span class="notif-content">
                          <strong>{{ n.title }}</strong>
                          <span>{{ n.message }}</span>
                          <small>{{ n.createdAt | date: 'short' }}</small>
                        </span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="account">
              <button class="user-menu" type="button" [appTooltip]="'shell.accountMenu' | translate" (click)="toggleAccountMenu()">
                <span class="avatar">{{ initials() }}</span>
                <span class="user-caret" appIcon="ChevronDown" [size]="14"></span>
              </button>
              @if (accountMenuOpen()) {
                <div class="dropdown account-menu">
                  <div class="account-meta">
                    <span class="avatar lg">{{ initials() }}</span>
                    <div class="account-meta-text">
                      <strong>{{ userEmail() }}</strong>
                      <span>{{ activeSlug() || ('shell.noWorkspace' | translate) }}</span>
                    </div>
                  </div>
                  <div class="dropdown-section">
                    <div class="dropdown-label">{{ 'shell.language' | translate }}</div>
                    <div class="lang-row">
                      <button class="lang-btn" type="button" [class.active]="i18n.lang() === 'hu'" (click)="setLang('hu')">
                        <span appIcon="Globe" [size]="14"></span> {{ 'shell.hungarian' | translate }}
                      </button>
                      <button class="lang-btn" type="button" [class.active]="i18n.lang() === 'en'" (click)="setLang('en')">
                        <span appIcon="Globe" [size]="14"></span> {{ 'shell.english' | translate }}
                      </button>
                    </div>
                  </div>
                  <a class="menu-link" routerLink="/settings" (click)="accountMenuOpen.set(false)">
                    <span appIcon="Settings" [size]="16"></span>{{ 'shell.accountSettings' | translate }}
                  </a>
                  <button class="logout-button" type="button" (click)="logout()">
                    <span appIcon="LogOut" [size]="16"></span>{{ 'shell.logout' | translate }}
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <section class="content">
          <router-outlet />
        </section>
      </main>

      <!-- Mobile sidebar -->
      @if (mobileOpen()) {
        <div class="mobile-backdrop" (click)="mobileOpen.set(false)"></div>
        <aside class="sidebar mobile" [class.open]="mobileOpen()">
          <div class="brand">
            <div class="brand-mark">
              <img src="/assets/viridian_fox_logo_white.png" alt="Viridian Studio" (error)="hideBrokenLogo($event)" />
            </div>
            <div class="brand-text">
              <strong>{{ applicationDetails().companyName }}</strong>
              <span>v{{ applicationDetails().version }}</span>
            </div>
          </div>
          <div class="workspace">
            <span class="workspace-label">{{ 'shell.workspace' | translate }}</span>
            <div class="workspace-select">
              <span class="workspace-glyph" [appIcon]="'Building2'" [size]="16"></span>
              <select [value]="activeSlug()" (change)="switchTenant($event)" aria-label="Workspace">
                @for (workspace of tenantStore.workspaces(); track workspace.tenantSlug) {
                  <option [value]="workspace.tenantSlug">{{ workspace.tenantSlug }}</option>
                }
              </select>
            </div>
          </div>
          <nav class="nav">
            @for (group of navGroups(); track group.label) {
              <div class="nav-group">
                <div class="nav-group-label">{{ group.label }}</div>
                @for (item of group.items; track item.path) {
                  <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" (click)="mobileOpen.set(false)">
                    <span class="nav-icon" [appIcon]="item.icon" [size]="18"></span>
                    <span class="nav-label">{{ item.labelKey | translate }}</span>
                  </a>
                }
              </div>
            }
          </nav>
        </aside>
      }

      <app-toast-outlet />
      <app-confirm-outlet />

      @if (paletteOpen()) {
        <app-command-palette [items]="commands()" [searchResults]="searchResults()" (close)="paletteOpen.set(false)" (queryChange)="onSearchQuery($event)" />
      }
    </div>
  `,
  styles: [`
    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      background: var(--bg);
    }
    .shell.collapsed { grid-template-columns: var(--sidebar-w-collapsed) 1fr; }

    /* ---------- Sidebar ---------- */
    .sidebar {
      border-right: 1px solid var(--line);
      background: var(--surface);
      display: flex;
      flex-direction: column;
      padding: var(--space-4) var(--space-3);
      gap: var(--space-4);
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      transition: width var(--dur-slow) var(--ease);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 4px 4px var(--space-2);
    }
    .brand-mark {
      display: grid; place-items: center;
      width: 38px; height: 38px; flex: 0 0 auto;
      overflow: hidden;
      border-radius: var(--radius-sm);
      background: black;
    }
    .brand-mark img { width: 26px; height: 26px; object-fit: contain; }
    .brand-text { display: grid; gap: 1px; min-width: 0; flex: 1; }
    .brand-text strong {
      font-size: 14px; line-height: 1.2;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .brand-text span { color: var(--muted); font-size: 11px; }

    .shell.collapsed .brand-text,
    .shell.collapsed .workspace,
    .shell.collapsed .nav-label,
    .shell.collapsed .nav-group-label { display: none; }
    .shell.collapsed .brand { justify-content: center; padding: 4px 0 var(--space-2); }

    .workspace { display: grid; gap: 6px; }
    .workspace-label {
      color: var(--muted-soft); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 0 4px;
    }
    .workspace-select {
      position: relative;
      display: flex; align-items: center; gap: var(--space-2);
      height: var(--control-h);
      padding: 0 var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface-soft);
    }
    .workspace-select .workspace-glyph { color: var(--muted); display: inline-flex; }
    .workspace-select select {
      flex: 1; border: 0; background: transparent; padding: 0;
      height: auto; appearance: none; -webkit-appearance: none;
      font-weight: 600; color: var(--ink); cursor: pointer;
    }
    .workspace-select select:focus { box-shadow: none; }
    .workspace-caret { color: var(--muted); pointer-events: none; }

    .nav { display: grid; gap: var(--space-4); flex: 1; }
    .nav-group { display: grid; gap: 2px; }
    .nav-group-label {
      color: var(--muted-soft); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 0 10px 4px;
    }
    .nav-item {
      display: flex; align-items: center; gap: var(--space-3);
      height: 36px; padding: 0 10px;
      border-radius: var(--radius-sm);
      color: var(--muted);
      font-weight: 500; font-size: 14px;
      transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
    }
    .nav-item:hover { background: var(--surface-hover); color: var(--ink); }
    .nav-item.active {
      background: var(--brand-soft); color: var(--brand-ink); font-weight: 600;
    }
    .nav-item.active .nav-icon { color: var(--brand-ink); }
    .nav-icon { display: inline-flex; flex: 0 0 auto; color: var(--muted); }
    .nav-item:hover .nav-icon { color: var(--ink); }
    .nav-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .shell.collapsed .nav-item { justify-content: center; padding: 0; }

    /* ---------- Topbar ---------- */
    .main { min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      height: var(--topbar-h);
      display: flex; align-items: center; gap: var(--space-3);
      padding: 0 var(--space-5);
      border-bottom: 1px solid var(--line);
      background: var(--surface);
      position: sticky; top: 0; z-index: 30;
    }
    .mobile-menu { display: none !important; }
    .sidebar-toggle { display: inline-grid; }
    .topbar-title { display: grid; gap: 1px; margin-right: auto; min-width: 0; }
    .topbar-title strong { font-size: 15px; line-height: 1.2; }
    .topbar-title span { color: var(--muted); font-size: 12px; }

    .search-trigger {
      display: flex; align-items: center; gap: var(--space-2);
      width: min(360px, 32vw);
      height: 36px;
      padding: 0 var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface-soft);
      color: var(--muted);
      font-size: 13px;
      transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    }
    .search-trigger:hover { border-color: var(--line-strong); background: var(--surface); }
    .search-trigger:focus-within { border-color: var(--brand); box-shadow: var(--focus); background: var(--surface); }
    .search-icon { display: inline-flex; }
    .search-text { flex: 1; text-align: left; }
    .search-kbd { display: inline-flex; gap: 3px; }

    .topbar-actions { display: flex; align-items: center; gap: var(--space-2); }
    .icon-btn {
      position: relative;
      display: inline-grid; place-items: center;
      width: 36px; height: 36px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface); color: var(--ink);
      box-shadow: var(--shadow-sm);
    }
    .icon-btn:hover { background: var(--surface-hover); border-color: var(--line-strong); }
    .notif-badge {
      position: absolute; top: -4px; right: -4px;
      min-width: 18px; height: 18px; padding: 0 5px;
      border-radius: 999px; background: var(--danger); color: #fff;
      font-size: 11px; font-weight: 700;
      display: grid; place-items: center;
      border: 2px solid var(--surface);
    }

    /* ---------- Dropdowns ---------- */
    .dropdown {
      position: absolute;
      right: 0; top: calc(100% + 8px);
      min-width: 260px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--elevated);
      box-shadow: var(--shadow-lg);
      z-index: 40;
      overflow: hidden;
      animation: dropdown-in var(--dur) var(--ease-out);
    }
    @keyframes dropdown-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .notifications, .account { position: relative; }
    .dropdown-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--line);
    }
    .dropdown-body { max-height: 380px; overflow: auto; padding: var(--space-2); display: grid; gap: 2px; }
    .notif-empty { display: grid; place-items: center; gap: var(--space-2); padding: var(--space-6); color: var(--muted); text-align: center; }
    .notif-empty p { margin: 0; font-size: 13px; }
    .notification-item {
      display: flex; gap: var(--space-3); align-items: flex-start;
      width: 100%; text-align: left;
      border: 0; border-radius: var(--radius-sm);
      background: transparent; padding: var(--space-3);
      cursor: pointer;
    }
    .notification-item:hover { background: var(--surface-hover); }
    .notification-item.unread { background: var(--brand-soft); }
    .notif-dot {
      width: 8px; height: 8px; border-radius: 999px; flex: 0 0 auto;
      margin-top: 6px; background: var(--line-strong);
    }
    .notif-dot.unread { background: var(--brand); }
    .notif-content { display: grid; gap: 2px; min-width: 0; }
    .notif-content strong { font-size: 13px; }
    .notif-content span { color: var(--muted); font-size: 13px; }
    .notif-content small { color: var(--muted-soft); font-size: 11px; }

    .account-menu { width: 280px; padding: var(--space-2); display: grid; gap: var(--space-2); }
    .account-meta {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--surface-soft);
    }
    .account-meta-text { display: grid; gap: 1px; min-width: 0; }
    .account-meta-text strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .account-meta-text span { color: var(--muted); font-size: 12px; }
    .dropdown-section { display: grid; gap: 6px; }
    .dropdown-label { color: var(--muted-soft); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 4px; }
    .lang-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .lang-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 34px; border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface); color: var(--muted); font-size: 13px; font-weight: 500;
    }
    .lang-btn:hover { background: var(--surface-hover); }
    .lang-btn.active { background: var(--brand-soft); color: var(--brand-ink); border-color: transparent; }
    .logout-button {
      display: flex; align-items: center; gap: var(--space-2);
      height: 38px; padding: 0 var(--space-3);
      border: 1px solid var(--danger-line); border-radius: var(--radius-sm);
      background: var(--danger-soft); color: var(--danger);
      font-weight: 600; font-size: 13px;
    }
    .logout-button:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
    .menu-link {
      display: flex; align-items: center; gap: var(--space-2);
      height: 38px; padding: 0 var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface); color: var(--ink);
      font-weight: 600; font-size: 13px;
    }
    .menu-link:hover { background: var(--surface-hover); border-color: var(--line-strong); }

    .user-menu {
      display: inline-flex; align-items: center; gap: 6px;
      height: 36px; padding: 0 6px 0 4px;
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface); box-shadow: var(--shadow-sm);
    }
    .user-menu:hover { background: var(--surface-hover); border-color: var(--line-strong); }
    .avatar {
      display: grid; place-items: center;
      width: 28px; height: 28px;
      border-radius: var(--radius-xs);
      background: var(--brand); color: #fff;
      font-size: 12px; font-weight: 700;
    }
    .avatar.lg { width: 40px; height: 40px; font-size: 14px; }
    :root[data-theme="dark"] .avatar { color: #04231f; }
    .user-caret { color: var(--muted); }

    .content {
      padding: var(--space-6);
      max-width: 1480px;
      width: 100%;
      margin: 0 auto;
      flex: 1;
    }

    /* ---------- Mobile ---------- */
    .mobile-backdrop {
      position: fixed; inset: 0; z-index: 48;
      background: var(--overlay);
      animation: fade-in var(--dur) var(--ease);
    }
    .sidebar.mobile {
      position: fixed; left: 0; top: 0; z-index: 50;
      width: var(--sidebar-w); height: 100vh;
      transform: translateX(-100%);
      animation: slide-in var(--dur-slow) var(--ease-out);
    }
    @keyframes slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
    .sidebar.mobile.open { transform: translateX(0); }

    @media (max-width: 1080px) {
      .search-trigger { width: 200px; }
    }
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar:not(.mobile) { display: none; }
      .mobile-menu { display: inline-grid; }
      .sidebar-toggle { display: none; }
      .search-trigger { width: 100%; max-width: none; order: 5; }
      .topbar { flex-wrap: wrap; height: auto; padding: var(--space-3); gap: var(--space-2); }
      .topbar-title { width: 100%; margin-right: 0; }
      .topbar-actions { margin-left: auto; }
      .content { padding: var(--space-4); }
    }
  `]
})
export class ShellComponent {
  private readonly auth = inject(AuthStore);
  private readonly applicationDetailsStore = inject(ApplicationDetailsStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly tenantStore = inject(TenantStore);
  readonly theme = inject(ThemeService);
  readonly accountMenuOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly notifications = signal<Notification[]>([]);
  readonly unread = signal<number>(0);
  readonly paletteOpen = signal(false);
  readonly searchQuery = signal('');
  readonly searchResults = signal<CommandItem[]>([]);
  readonly collapsed = signal(localStorage.getItem('fleger.sidebar') === 'collapsed');
  readonly mobileOpen = signal(false);
  readonly applicationDetails = this.applicationDetailsStore.details;
  readonly activeSlug = computed(
    () => this.tenantStore.activeWorkspace()?.tenantSlug ?? ''
  );
  readonly userEmail = computed(() => this.auth.user()?.email ?? 'Unknown user');
  readonly initials = computed(() => {
    const email = this.auth.user()?.email ?? 'FW';
    return email.slice(0, 2).toUpperCase();
  });

  readonly navGroups = computed<NavGroup[]>(() => {
    const user = this.auth.user();
    const isAdmin = user?.platformAdmin === true || user?.superAdmin === true;

    const groups: NavGroup[] = [
      {
        label: 'Main',
        items: [
          { path: '/dashboard', labelKey: 'shell.nav.dashboard', icon: 'LayoutDashboard' },
          { path: '/inventory', labelKey: 'shell.nav.inventory', icon: 'Package' },
          { path: '/employees', labelKey: 'shell.nav.employees', icon: 'Users' },
          { path: '/vehicles', labelKey: 'shell.nav.vehicles', icon: 'Truck' },
          { path: '/assignments', labelKey: 'shell.nav.assignments', icon: 'ClipboardCheck' },
        ],
      },
      {
        label: 'Management',
        items: [
          { path: '/team', labelKey: 'shell.nav.team', icon: 'UserPlus' },
          { path: '/roles', labelKey: 'shell.nav.roles', icon: 'ShieldCheck' },
          { path: '/audit-log', labelKey: 'shell.nav.auditLog', icon: 'ScrollText' },
        ],
      },
      {
        label: 'System',
        items: [
          { path: '/settings', labelKey: 'shell.nav.settings', icon: 'Settings' },
          ...(isAdmin ? [{ path: '/platform-admin', labelKey: 'shell.nav.platformAdmin', icon: 'Building2' as AppIconName }] : []),
        ],
      },
    ];

    // Filter out empty groups
    return groups.filter((g) => g.items.length > 0);
  });

  readonly commands = computed<CommandItem[]>(() => {
    const groups = this.navGroups();
    const items: CommandItem[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        items.push({
          id: item.path,
          label: this.i18n.t(item.labelKey),
          group: group.label,
          icon: item.icon,
          route: item.path,
        });
      }
    }
    return items;
  });

  constructor() {
    effect(() => {
      this.tenantStore.activeWorkspace();
      this.loadNotifications();
    });

    this.router.events.subscribe(() => {
      this.accountMenuOpen.set(false);
      this.notificationsOpen.set(false);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openPalette();
    }
  }

  openPalette() {
    this.paletteOpen.set(true);
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  onSearchQuery(query: string) {
    this.searchQuery.set(query);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (query.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      const q = this.searchQuery().trim();
      if (!q) {
        this.searchResults.set([]);
        return;
      }
      untracked(() => {
        this.api.get<Array<{ id: string; type: string; label: string; subtitle: string; route: string }>>(`/search?q=${encodeURIComponent(q)}`).subscribe({
          next: (results) => {
            const items: CommandItem[] = results.map((r) => ({
              id: r.id,
              label: r.label,
              group: r.type === 'inventory' ? 'Inventory' : r.type === 'employee' ? 'Employees' : 'Vehicles',
              icon: r.type === 'inventory' ? 'Package' : r.type === 'employee' ? 'Users' : 'Truck',
              hint: r.subtitle,
              route: r.route
            }));
            this.searchResults.set(items);
          },
          error: () => this.searchResults.set([])
        });
      });
    }, 250);
  }

  toggleCollapsed() {
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem('fleger.sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }

  switchTenant(event: Event) {
    this.tenantStore.switch((event.target as HTMLSelectElement).value);
  }

  loadNotifications() {
    if (!this.tenantStore.activeWorkspace()) return;
    this.api.get<Notification[]>('/notifications').subscribe({
      next: (n) => this.notifications.set(n)
    });
    this.api.get<number>('/notifications/unread').subscribe({
      next: (count) => this.unread.set(count)
    });
  }

  toggleNotifications() {
    this.accountMenuOpen.set(false);
    this.notificationsOpen.update((open) => !open);
  }

  markRead(id: string) {
    this.api.patch<Notification>(`/notifications/${id}/read`, {}).subscribe({
      next: () => this.loadNotifications()
    });
  }

  setLang(language: string) {
    this.i18n.setLang(language);
  }

  toggleAccountMenu() {
    this.notificationsOpen.set(false);
    this.accountMenuOpen.update((open) => !open);
  }

  logout() {
    this.accountMenuOpen.set(false);
    this.auth.logout();
    this.tenantStore.clear();
    void this.router.navigateByUrl('/login');
  }

  activeLabel() {
    for (const group of this.navGroups()) {
      const item = group.items.find((i) => this.router.url.startsWith(i.path));
      if (item) return this.i18n.t(item.labelKey);
    }
    return this.i18n.t('shell.nav.dashboard');
  }

  hideBrokenLogo(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
