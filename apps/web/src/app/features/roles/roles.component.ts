import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

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
      { value: 'settings.manage', label: 'Manage settings', description: 'Change workspace-level settings.' }
    ]
  }
];

const PERMISSION_ORDER = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.value));

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Roles</h1>
          <p>Create any role and choose exactly which permissions it gets.</p>
        </div>
        <button class="primary-button" type="button" (click)="startCreate()">
          <span appIcon="Plus"></span>
          Add role
        </button>
      </div>

      @if (formOpen()) {
        <form class="toolbar-card role-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="form-header">
            <div>
              <span class="eyebrow">{{ editing() ? 'Edit role' : 'New role' }}</span>
              <h2>{{ editing()?.name || 'Custom role' }}</h2>
            </div>
            <button class="icon-button" type="button" title="Close" (click)="cancelForm()">
              <span appIcon="X"></span>
            </button>
          </div>

          <label class="field role-name">
            <span>Role name</span>
            <input placeholder="Example: Warehouse supervisor" formControlName="name" />
          </label>

          <div class="permission-toolbar">
            <div>
              <strong>Permissions</strong>
              <span>{{ selectedPermissions().length }} selected</span>
            </div>
            <div class="permission-actions">
              <button class="ghost-button" type="button" (click)="selectAll()">
                <span appIcon="CircleCheck"></span>
                Select all
              </button>
              <button class="ghost-button" type="button" (click)="clearAll()">Clear</button>
            </div>
          </div>

          <div class="permission-grid">
            @for (group of permissionGroups; track group.name) {
              <fieldset class="permission-group">
                <legend>{{ group.name }}</legend>
                @for (permission of group.permissions; track permission.value) {
                  <label class="permission-option" [class.selected]="isPermissionSelected(permission.value)">
                    <input
                      type="checkbox"
                      [checked]="isPermissionSelected(permission.value)"
                      (change)="togglePermission(permission.value)"
                    />
                    <span class="permission-check"><span appIcon="CircleCheck" [size]="15"></span></span>
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

          <div class="form-actions">
            <button class="ghost-button" type="button" (click)="cancelForm()">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="form.invalid || selectedPermissions().length === 0">
              <span appIcon="Save"></span>
              Save role
            </button>
          </div>
        </form>
      }

      <div class="table-shell">
        <div class="table-title">
          <h2>Role list</h2>
          <span class="status-pill">{{ roles().length }} records</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
        @for (role of roles(); track role._id) {
            <tr>
              <td data-label="Role">
                <strong>{{ role.name }}</strong>
              </td>
              <td data-label="Type">
                <span class="status-pill" [class.info]="role.systemRole">{{ role.systemRole ? 'System role' : 'Custom role' }}</span>
              </td>
              <td data-label="Permissions">
                <div class="permission-chips">
                  @for (permission of sortedPermissions(role.permissions); track permission) {
                    <code>{{ permission }}</code>
                  }
                </div>
              </td>
              <td data-label="Actions">
                <button class="ghost-button" type="button" (click)="edit(role)">
                  <span appIcon="Settings"></span>
                  Edit
                </button>
                <button class="danger-button" type="button" [disabled]="role.systemRole" (click)="remove(role)">
                  <span appIcon="Trash2"></span>
                  Delete
                </button>
              </td>
            </tr>
        }
          </tbody>
        </table>
        @if (!roles().length) {
          <div class="empty-state">No roles yet.</div>
        }
      </div>
    </section>
  `,
  styles: `
    h1 { margin: 0; font-size: 28px; }
    h2 { margin: 0; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 13px 16px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0; }
    tr:last-child td { border-bottom: 0; }
    .role-form { display: grid; gap: 16px; }
    .form-header,
    .permission-toolbar,
    .form-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .eyebrow {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
      margin-bottom: 4px;
    }
    .role-name { max-width: 520px; }
    .permission-toolbar {
      padding-top: 4px;
      border-top: 1px solid var(--line);
    }
    .permission-toolbar strong {
      display: block;
      margin-bottom: 3px;
    }
    .permission-toolbar span {
      color: var(--muted);
      font-size: 13px;
    }
    .permission-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .permission-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .permission-group {
      display: grid;
      gap: 8px;
      min-width: 0;
      margin: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-soft);
    }
    legend {
      padding: 0 6px;
      color: var(--ink);
      font-weight: 800;
    }
    .permission-option {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 10px;
      align-items: start;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    .permission-option:hover {
      border-color: var(--line-strong);
      box-shadow: 0 8px 18px rgba(15, 23, 42, .06);
    }
    .permission-option:focus-within {
      border-color: var(--brand);
      box-shadow: var(--focus);
    }
    .permission-option.selected {
      border-color: #9cd3ca;
      background: var(--brand-soft);
    }
    .permission-option input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .permission-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      color: transparent;
      background: white;
    }
    .permission-option.selected .permission-check {
      border-color: var(--brand);
      background: var(--brand);
      color: white;
    }
    .permission-copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .permission-copy small {
      color: var(--muted);
      line-height: 1.35;
    }
    code {
      width: fit-content;
      border-radius: 6px;
      background: #eef2f7;
      color: #334155;
      padding: 3px 6px;
      font-size: 12px;
    }
    .permission-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-width: 720px;
    }
    td[data-label="Actions"] {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 980px) {
      .permission-grid { grid-template-columns: 1fr; }
      .permission-toolbar,
      .form-actions { align-items: stretch; flex-direction: column; }
      .permission-actions { justify-content: flex-start; }
    }
    @media (max-width: 720px) {
      table, thead, tbody, tr, th, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--line); }
      tr:last-child { border-bottom: 0; }
      td { border-bottom: 0; padding: 10px 14px; }
      td::before {
        content: attr(data-label);
        display: block;
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        margin-bottom: 5px;
      }
    }
  `
})
export class RolesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly permissionGroups = PERMISSION_GROUPS;
  readonly roles = signal<Role[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<Role | null>(null);
  readonly selectedPermissions = signal<string[]>(DEFAULT_PERMISSIONS);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  load() {
    this.api.get<Role[]>('/roles').subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => this.roles.set([])
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
    if (this.form.invalid || !this.selectedPermissions().length) return;
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
        this.toasts.success(role ? 'Role updated.' : 'Role created.');
        this.cancelForm();
        this.load();
      },
      error: () => this.toasts.error(role ? 'Could not update role.' : 'Could not create role.')
    });
  }

  remove(role: Role) {
    if (role.systemRole || !window.confirm(`Delete role "${role.name}"?`)) return;
    this.api.delete<Role>(`/roles/${role._id}`).subscribe({
      next: () => {
        this.toasts.success('Role deleted.');
        if (this.editing()?._id === role._id) this.cancelForm();
        this.load();
      },
      error: () => this.toasts.error('Could not delete role.')
    });
  }
}
