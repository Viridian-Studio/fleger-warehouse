import { Component, computed, inject, signal } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { ApplicationDetailsStore } from "../core/application/application-details.store";
import { AuthStore } from "../core/auth/auth.store";
import { TenantStore } from "../core/tenant/tenant.store";
import { IconDirective } from "../shared/ui/icon.directive";
import { ToastOutletComponent } from "../shared/ui/toast-outlet.component";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    IconDirective,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ToastOutletComponent,
  ],
  template: `
    <div class="shell">
      <aside>
        <div class="brand">
          <div class="brand-mark">
            <img
              src="/assets/viridian_fox_logo_white.png"
              alt="Viridian Studio"
              (error)="hideBrokenLogo($event)"
            />
          </div>
          <div>
            <strong>{{ applicationDetails().companyName }}</strong>
            <span
              >v{{ applicationDetails().version }} ·
              {{ applicationDetails().buildName }}</span
            >
          </div>
        </div>

        <div class="workspace">
          <span>Workspace</span>
          <select
            [value]="activeSlug()"
            (change)="switchTenant($event)"
            title="Workspace"
          >
            @for (
              workspace of tenantStore.workspaces();
              track workspace.tenantSlug
            ) {
              <option [value]="workspace.tenantSlug">
                {{ workspace.tenantSlug }}
              </option>
            }
          </select>
        </div>

        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active">
              <span class="nav-icon" [appIcon]="item.icon"></span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>

      <main>
        <header>
          <div class="header-title">
            <strong>{{ activeLabel() }}</strong>
            <span>{{ activeSlug() || "No workspace" }}</span>
          </div>
          <div class="search"><input placeholder="Search records" /></div>
          <button class="icon-button" title="Notifications">
            <span appIcon="Bell"></span>
          </button>
          <div class="account">
            <button
              class="user-menu"
              title="Account menu"
              (click)="toggleAccountMenu()"
            >
              <span class="avatar">{{ initials() }}</span>
              <span appIcon="ChevronDown" [size]="14"></span>
            </button>
            @if (accountMenuOpen()) {
              <div class="account-menu">
                <div class="account-meta">
                  <strong>{{ userEmail() }}</strong>
                  <span>{{ activeSlug() || "No workspace" }}</span>
                </div>
                <button class="logout-button" (click)="logout()">
                  <span appIcon="LogOut"></span>Logout
                </button>
              </div>
            }
          </div>
        </header>

        <section class="content">
          <router-outlet />
        </section>
      </main>
      <app-toast-outlet />
    </div>
  `,
  styles: `
    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 272px 1fr;
    }
    aside {
      border-right: 1px solid var(--line);
      background: #fbfcfe;
      padding: 18px 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 6px 18px;
    }
    .brand-mark {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      overflow: hidden;
      border-radius: 8px;
      background: black;
      color: white;
      font-weight: 900;
    }
    .brand-mark img,
    .brand-mark span {
      grid-area: 1 / 1;
    }
    .brand-mark img {
      width: 30px;
      height: 30px;
      object-fit: contain;
      display: block;
      z-index: 1;
    }
    .brand-mark span {
      font-size: 12px;
      letter-spacing: 0;
    }
    .brand strong,
    .brand span {
      display: block;
      line-height: 1.15;
    }
    .brand strong {
      max-width: 190px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .brand span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .workspace {
      display: grid;
      gap: 7px;
      margin-bottom: 18px;
    }
    .workspace span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    select {
      width: 100%;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: white;
    }
    nav {
      display: grid;
      gap: 4px;
    }
    a {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--muted);
      text-decoration: none;
      font-weight: 700;
    }
    a.active,
    a:hover {
      color: var(--ink);
      background: var(--brand-soft);
    }
    main {
      min-width: 0;
    }
    header {
      height: 68px;
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: flex-end;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: white;
      position: sticky;
      top: 0;
      z-index: 3;
    }
    .header-title {
      margin-right: auto;
      display: grid;
      gap: 2px;
    }
    .header-title strong {
      font-size: 15px;
    }
    .header-title span {
      color: var(--muted);
      font-size: 13px;
    }
    .nav-icon {
      display: inline-grid;
      place-items: center;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: min(360px, 34vw);
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      color: var(--muted);
      background: var(--panel-soft);
    }
    .search input {
      width: 100%;
      border: 0;
      outline: 0;
    }
    .account {
      position: relative;
    }
    .user-menu {
      height: 36px;
      border: 0;
      border-radius: 8px;
      padding: 0 8px 0 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--brand);
      color: white;
      font-weight: 700;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.16);
    }
    .account-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      width: 260px;
      display: grid;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      padding: 10px;
      box-shadow: var(--shadow);
      z-index: 10;
    }
    .account-meta {
      display: grid;
      gap: 3px;
      padding: 8px;
      border-bottom: 1px solid var(--line);
      min-width: 0;
    }
    .account-meta strong,
    .account-meta span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .account-meta span {
      color: var(--muted);
      font-size: 13px;
    }
    .logout-button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      border: 0;
      border-radius: 8px;
      background: var(--danger-soft);
      color: var(--danger);
      padding: 0 10px;
      font-weight: 800;
      text-align: left;
    }
    .content {
      padding: 24px;
      max-width: 1440px;
    }
    @media (max-width: 860px) {
      .shell {
        grid-template-columns: 1fr;
      }
      aside {
        position: sticky;
        top: 0;
        z-index: 2;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .brand {
        padding-bottom: 10px;
      }
      nav {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      a span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      header {
        position: static;
        height: auto;
        padding: 14px;
        flex-wrap: wrap;
      }
      .header-title {
        width: 100%;
      }
      .search {
        width: 100%;
        order: 4;
      }
    }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthStore);
  private readonly applicationDetailsStore = inject(ApplicationDetailsStore);
  private readonly router = inject(Router);
  readonly tenantStore = inject(TenantStore);
  readonly accountMenuOpen = signal(false);
  readonly applicationDetails = this.applicationDetailsStore.details;
  readonly activeSlug = computed(
    () => this.tenantStore.activeWorkspace()?.tenantSlug ?? "",
  );
  readonly userEmail = computed(
    () => this.auth.user()?.email ?? "Unknown user",
  );
  readonly initials = computed(() => {
    const email = this.auth.user()?.email ?? "FW";
    return email.slice(0, 2).toUpperCase();
  });
  readonly nav = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: "LayoutDashboard" as const,
    },
    { path: "/inventory", label: "Inventory", icon: "Package" as const },
    { path: "/employees", label: "Employees", icon: "Users" as const },
    { path: "/vehicles", label: "Vehicles", icon: "Truck" as const },
    {
      path: "/assignments",
      label: "Assignments",
      icon: "ClipboardCheck" as const,
    },
    { path: "/team", label: "Team", icon: "UserPlus" as const },
    { path: "/roles", label: "Roles", icon: "ShieldCheck" as const },
    { path: "/audit-log", label: "Audit Logs", icon: "ScrollText" as const },
    { path: "/settings", label: "Settings", icon: "Settings" as const },
    { path: "/billing", label: "Billing", icon: "CreditCard" as const },
    {
      path: "/platform-admin",
      label: "Platform Admin",
      icon: "Building2" as const,
    },
  ];

  switchTenant(event: Event) {
    this.tenantStore.switch((event.target as HTMLSelectElement).value);
  }

  toggleAccountMenu() {
    this.accountMenuOpen.update((open) => !open);
  }

  logout() {
    this.accountMenuOpen.set(false);
    this.auth.logout();
    this.tenantStore.clear();
    void this.router.navigateByUrl("/login");
  }

  activeLabel() {
    return (
      this.nav.find((item) => this.router.url.startsWith(item.path))?.label ??
      "Dashboard"
    );
  }

  hideBrokenLogo(event: Event) {
    (event.target as HTMLImageElement).style.display = "none";
  }
}
