import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface Workspace {
  tenantSlug: string;
  tenantId: string;
  status: string;
  permissions: string[];
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class TenantStore {
  private readonly api = inject(ApiService);
  private readonly storedUser = this.readStoredUser();
  readonly workspaces = signal<Workspace[]>(this.storedUser?.memberships ?? []);
  /** All tenants on the platform — only loaded for super/platform admins. */
  readonly allTenants = signal<Tenant[]>([]);

  readonly activeWorkspace = signal<Workspace | null>(this.workspaces()[0] ?? null);
  readonly version = signal(0);

  setWorkspaces(workspaces: Workspace[]) {
    if (workspaces.length === 0) return;
    this.workspaces.set(workspaces);
    this.activeWorkspace.set(workspaces[0]);
    this.version.update((value) => value + 1);
  }

  /** Load every tenant on the platform (platform-admin endpoint). */
  loadAllTenants() {
    this.api.get<Tenant[]>('/platform-admin/tenants').subscribe({
      next: (tenants) => this.allTenants.set(tenants),
      error: () => this.allTenants.set([])
    });
  }

  switch(slug: string) {
    const workspace = this.workspaces().find((item) => item.tenantSlug === slug);
    if (workspace) {
      this.activeWorkspace.set(workspace);
      this.version.update((value) => value + 1);
      return;
    }
    // Super admin: allow switching to a tenant the user has no membership in.
    const tenant = this.allTenants().find((item) => item.slug === slug);
    if (tenant) {
      this.activeWorkspace.set({
        tenantSlug: tenant.slug,
        tenantId: tenant._id,
        status: tenant.status,
        permissions: []
      });
      this.version.update((value) => value + 1);
    }
  }

  clear() {
    this.workspaces.set([]);
    this.allTenants.set([]);
    this.activeWorkspace.set(null);
    this.version.update((value) => value + 1);
  }

  private readStoredUser(): { memberships: Workspace[] } | null {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as { memberships: Workspace[] };
    } catch {
      return null;
    }
  }
}
