import { Injectable, signal } from '@angular/core';

export interface Workspace {
  tenantSlug: string;
  tenantId: string;
  status: string;
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class TenantStore {
  private readonly storedUser = this.readStoredUser();
  readonly workspaces = signal<Workspace[]>(this.storedUser?.memberships ?? []);

  readonly activeWorkspace = signal<Workspace | null>(this.workspaces()[0] ?? null);
  readonly version = signal(0);

  setWorkspaces(workspaces: Workspace[]) {
    if (workspaces.length === 0) return;
    this.workspaces.set(workspaces);
    this.activeWorkspace.set(workspaces[0]);
    this.version.update((value) => value + 1);
  }

  switch(slug: string) {
    const workspace = this.workspaces().find((item) => item.tenantSlug === slug);
    if (workspace) {
      this.activeWorkspace.set(workspace);
      this.version.update((value) => value + 1);
    }
  }

  clear() {
    this.workspaces.set([]);
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
