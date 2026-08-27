import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';

interface Role {
  _id: string;
  name: string;
  permissions: string[];
  systemRole: boolean;
}

interface PermissionItem {
  value: string;
  label: string;
  description: string;
}

interface PermissionGroup {
  name: string;
  permissions: PermissionItem[];
}

const DEFAULT_PERMISSIONS = ['inventory.read', 'employee.read', 'vehicle.read'];
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Inventory',
    permissions: [
      { value: 'inventory.read', label: 'Read inventory', description: 'View stock, tools, PPE and material records.' },
      { value: 'inventory.create', label: 'Create inventory', description: 'Add new stock and tracked items.' },
      { value: 'inventory.update', label: 'Update inventory', description: 'Edit stock data, quantities and statuses.' },
      { value: 'inventory.assign', label: 'Assign inventory', description: 'Issue and return inventory to employees.' }
    ]
  },
  {
    name: 'Employees',
    permissions: [
      { value: 'employee.read', label: 'Read employees', description: 'View employee records and profiles.' },
      { value: 'employee.create', label: 'Create employees', description: 'Add new employees to the workspace.' },
      { value: 'employee.update', label: 'Update employees', description: 'Edit employee data and employment details.' },
      { value: 'employee.disable', label: 'Disable employees', description: 'Deactivate and reactivate employees.' }
    ]
  },
  {
    name: 'Vehicles',
    permissions: [
      { value: 'vehicle.read', label: 'Read vehicles', description: 'View fleet records and assignment state.' },
      { value: 'vehicle.create', label: 'Create vehicles', description: 'Add vehicles to the fleet.' },
      { value: 'vehicle.update', label: 'Update vehicles', description: 'Edit mileage, status and vehicle details.' },
      { value: 'vehicle.assign', label: 'Assign vehicles', description: 'Issue and return vehicles.' }
    ]
  },
  {
    name: 'Team',
    permissions: [
      { value: 'user.read', label: 'Read users', description: 'View workspace members and invitations.' },
      { value: 'user.invite', label: 'Invite users', description: 'Invite new team members.' },
      { value: 'user.disable', label: 'Disable users', description: 'Deactivate workspace users.' }
    ]
  },
  {
    name: 'Administration',
    permissions: [
      { value: 'audit.read', label: 'Read audit log', description: 'Inspect workspace activity history.' },
      { value: 'role.manage', label: 'Manage roles', description: 'Create and edit roles and permissions.' },
      { value: 'settings.manage', label: 'Manage settings', description: 'Change workspace-level settings.' },
      { value: 'updates.read', label: 'Read updates', description: 'View build release notes and changelogs.' },
      { value: 'updates.manage', label: 'Manage updates', description: 'Create and publish new build release notes.' }
    ]
  }
];

const PERMISSION_ORDER = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.value));

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Roles</h1>
          <p>Create any role and choose exactly which permissions it gets.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--primary" type="button" (click)="startCreate()">
            <span appIcon="Plus" [size]="16"></span>Add role
          </button>
        </div>
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Role list</h2><span class="table-meta">{{ roles().length }} records</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                  <span class="skeleton skeleton--line" style="width: 40%"></span>
                </div>
              }
            </div>
          } @else if (roles().length === 0) {
            <app-empty-state icon="ShieldCheck" title="No roles yet" description="Create a custom role to control what your teammates can do.">
              <button class="btn btn--primary" type="button" (click)="startCreate()"><span appIcon="Plus" [size]="16"></span>Add role</button>
            </app-empty-state>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Permissions</th>
                  <th style="text-align: right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (role of roles(); track role._id) {
                  <tr>
                    <td data-label="Role"><strong>{{ role.name }}</strong></td>
                    <td data-label="Type">
                      <span class="badge" [class.badge--info]="role.systemRole" [class.badge--muted]="!role.systemRole">
                        <span class="dot"></span>{{ role.systemRole ? 'System' : 'Custom' }}
                      </span>
                    </td>
                    <td data-label="Permissions">
                      <div class="permission-chips">
                        @for (permission of sortedPermissions(role.permissions); track permission) {
                          <code>{{ permission }}</code>
                        }
                      </div>
                    </td>
                    <td data-label="Actions">
                      <div class="row-actions">
                        <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="edit(role)">
                          <span appIcon="Pencil" [size]="16"></span>
                        </button>
                        <button class="btn--icon btn--subtle btn--sm" type="button" [disabled]="role.systemRole" appTooltip="Delete" (click)="remove(role)">
                          <span appIcon="Trash2" [size]="16"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      @if (formOpen()) {
        <app-modal [title]="editing() ? 'Edit role' : 'New role'" [description]="editing()?.name || 'Configure a custom role and its permissions.'" size="lg" (close)="cancelForm()">
          <form class="role-form" [formGroup]="form" (ngSubmit)="save()">
            <label class="field role-name">
              <span class="field-label">Role name <span class="req">*</span></span>
              <input placeholder="Example: Warehouse supervisor" formControlName="name" />
            </label>

            <div class="permission-toolbar">
              <div>
                <strong>Permissions</strong>
                <span class="muted">{{ selectedPermissions().length }} selected</span>
              </div>
              <div class="permission-actions">
                <button class="btn btn--ghost btn--sm" type="button" (click)="selectAll()"><span appIcon="CircleCheck" [size]="14"></span>Select all</button>
                <button class="btn btn--subtle btn--sm" type="button" (click)="clearAll()">Clear</button>
              </div>
            </div>

            <div class="permission-grid">
              @for (group of permissionGroups; track group.name) {
                <fieldset class="permission-group">
                  <legend>{{ group.name }}</legend>
                  @for (permission of group.permissions; track permission.value) {
                    <label class="permission-option" [class.selected]="isPermissionSelected(permission.value)">
                      <input type="checkbox" [checked]="isPermissionSelected(permission.value)" (change)="togglePermission(permission.value)" />
                      <span class="permission-check"><span appIcon="Check" [size]="14"></span></span>
                      <span class="permission-copy">
                        <strong>{{ permission.label }}</strong>
                        <small>{{ permission.description }}</small>
                        <code>{{ permission.value }}</code>
                      </span>
                    </label>
                  }
                </fieldset>
              }
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="cancelForm()">Cancel</button>
            <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || selectedPermissions().length === 0 || saving()" (click)="save()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Save role
            </button>
          </div>
        </app-modal>
      }
    </section>
  `,
  styles: [`
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .role-form { display: grid; gap: var(--space-4); }
    .role-name { max-width: 420px; }
    .permission-toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--line);
    }
    .permission-toolbar strong { display: block; }
    .permission-toolbar .muted { font-size: 13px; }
    .permission-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: flex-end; }
    .permission-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .permission-group {
      display: grid; gap: var(--space-2); min-width: 0; margin: 0;
      padding: var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius);
      background: var(--surface-soft);
    }
    legend { padding: 0 6px; color: var(--ink-strong); font-weight: 600; font-size: 13px; }
    .permission-option {
      display: grid; grid-template-columns: 20px 1fr; gap: var(--space-3); align-items: start;
      padding: var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface); cursor: pointer;
      transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .permission-option:hover { border-color: var(--line-strong); }
    .permission-option.selected { border-color: var(--brand); background: var(--brand-soft); }
    .permission-option input { position: absolute; opacity: 0; pointer-events: none; }
    .permission-check {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px;
      border: 1px solid var(--line-strong); border-radius: var(--radius-xs);
      color: transparent; background: var(--surface);
    }
    .permission-option.selected .permission-check { border-color: var(--brand); background: var(--brand); color: #fff; }
    :root[data-theme="dark"] .permission-option.selected .permission-check { color: #04231f; }
    .permission-copy { display: grid; gap: 3px; min-width: 0; }
    .permission-copy strong { font-size: 13px; font-weight: 600; }
    .permission-copy small { color: var(--muted); line-height: 1.4; font-size: 12px; }
    code {
      width: fit-content; border-radius: var(--radius-xs); background: var(--surface-soft);
      color: var(--muted); padding: 2px 6px; font-size: 11px; font-family: var(--font-mono);
    }
    .permission-chips { display: flex; flex-wrap: wrap; gap: 5px; max-width: 560px; }
    @media (max-width: 980px) {
      .permission-grid { grid-template-columns: 1fr; }
      .permission-toolbar { flex-direction: column; align-items: stretch; }
      .permission-actions { justify-content: flex-start; }
    }
    @media (max-width: 720px) {
      table, thead, tbody, tr, th, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--line); }
      tr:last-child { border-bottom: 0; }
      td { border-bottom: 0; padding: var(--space-2) var(--space-4); }
      td::before {
        content: attr(data-label);
        display: block;
        color: var(--muted); font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
      }
      td[data-label="Actions"] .row-actions { justify-content: flex-start; }
    }
  `]
})
export class RolesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly permissionGroups = PERMISSION_GROUPS;
  readonly roles = signal<Role[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<Role | null>(null);
  readonly selectedPermissions = signal<string[]>(DEFAULT_PERMISSIONS);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly skeletons = [1, 2, 3, 4];
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.get<Role[]>('/roles').subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.roles.set([]);
        this.loading.set(false);
      }
    });
  }

  startCreate() {
    this.editing.set(null);
    this.selectedPermissions.set([...DEFAULT_PERMISSIONS]);
    this.form.reset({ name: '' });
    this.formOpen.set(true);
  }

  edit(role: Role) {
    this.editing.set(role);
    this.selectedPermissions.set(this.sortedPermissions(role.permissions));
    this.form.reset({ name: role.name });
    this.formOpen.set(true);
  }

  cancelForm() {
    this.formOpen.set(false);
    this.editing.set(null);
    this.form.reset({ name: '' });
    this.selectedPermissions.set([...DEFAULT_PERMISSIONS]);
  }

  isPermissionSelected(permission: string) {
    return this.selectedPermissions().includes(permission);
  }

  togglePermission(permission: string) {
    this.selectedPermissions.update((permissions) => {
      if (permissions.includes(permission)) {
        return permissions.filter((item) => item !== permission);
      }
      return this.sortedPermissions([...permissions, permission]);
    });
  }

  selectAll() {
    this.selectedPermissions.set([...PERMISSION_ORDER]);
  }

  clearAll() {
    this.selectedPermissions.set([]);
  }

  sortedPermissions(permissions: string[]) {
    return [...permissions].sort((a, b) => {
      const aIndex = PERMISSION_ORDER.indexOf(a);
      const bIndex = PERMISSION_ORDER.indexOf(b);
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      if (normalizedA !== normalizedB) return normalizedA - normalizedB;
      return a.localeCompare(b);
    });
  }

  save() {
    if (this.form.invalid || !this.selectedPermissions().length || this.saving()) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      permissions: this.sortedPermissions(this.selectedPermissions())
    };
    const role = this.editing();
    const request = role
      ? this.api.patch<Role>(`/roles/${role._id}`, payload)
      : this.api.post<Role>('/roles', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(role ? 'Role updated.' : 'Role created.');
        this.cancelForm();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error(role ? 'Could not update role.' : 'Could not create role.');
      }
    });
  }

  async remove(role: Role) {
    if (role.systemRole) return;
    const ok = await this.confirm.confirm({
      title: `Delete role "${role.name}"?`,
      message: 'Members assigned to this role will lose their permissions. This action cannot be undone.',
      confirmLabel: 'Delete role',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.confirm.setLoading(true);
    this.api.delete<Role>(`/roles/${role._id}`).subscribe({
      next: () => {
        this.confirm.setLoading(false);
        this.toasts.success('Role deleted.');
        if (this.editing()?._id === role._id) this.cancelForm();
        this.load();
      },
      error: () => {
        this.confirm.setLoading(false);
        this.toasts.error('Could not delete role.');
      }
    });
  }
}
