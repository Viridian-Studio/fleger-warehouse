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

interface TeamMember {
  membershipId: string;
  status: string;
  permissions: string[];
  roleId?: string;
  user?: { _id: string; username: string; email: string; globalStatus: string; employeeId?: string };
}

interface Role {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Team</h1>
          <p>{{ members().length }} workspace members.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--primary" type="button" (click)="openCreate()">
            <span appIcon="UserPlus" [size]="16"></span>Add member
          </button>
        </div>
      </div>

      @if (createdMember()) {
        <div class="alert alert--success">
          <span class="alert-icon" appIcon="CircleCheck" [size]="18"></span>
          <div class="alert-body">
            <strong>Team member created</strong>
            <p>Share these credentials with the new member. They will be asked to change the password on first login.</p>
            <div class="credentials-box">
              <div class="credential-row">
                <span class="credential-label">Username:</span>
                <span class="mono">{{ createdMember()?.username }}</span>
              </div>
              <div class="credential-row">
                <span class="credential-label">Temp password:</span>
                <span class="mono credential-value">{{ createdMember()?.tempPassword }}</span>
              </div>
            </div>
          </div>
          <div class="alert-actions">
            <button class="btn btn--ghost btn--sm" type="button" (click)="copyCredentials()">
              <span appIcon="ClipboardCheck" [size]="14"></span> Copy credentials
            </button>
            <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Dismiss" (click)="createdMember.set(null)">
              <span appIcon="X" [size]="16"></span>
            </button>
          </div>
        </div>
      }

      <div class="table-shell">
        <div class="table-title"><h2>Members</h2><span class="table-meta">{{ members().length }} records</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 28%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                </div>
              }
            </div>
          } @else if (members().length === 0) {
            <app-empty-state icon="Users" title="No team members yet" description="Invite teammates to collaborate in this workspace.">
              <button class="btn btn--primary" type="button" (click)="openCreate()"><span appIcon="UserPlus" [size]="16"></span>Add member</button>
            </app-empty-state>
          } @else {
            <div class="row head"><span>User</span><span>Email</span><span>Status</span><span>Permissions</span><span></span></div>
            @for (member of members(); track member.membershipId) {
              <div class="row">
                <strong class="truncate">{{ member.user?.username || member.user?.email || 'Unknown user' }}</strong>
                <span class="col-muted truncate">{{ member.user?.email }}</span>
                <span class="badge" [class.badge--good]="member.status === 'ACTIVE'" [class.badge--info]="member.status === 'INVITED'" [class.badge--muted]="member.status === 'DISABLED'">{{ member.status }}</span>
                <span class="col-muted">{{ member.permissions.length }} permissions</span>
                <span class="row-actions">
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="openEdit(member)">
                    <span appIcon="Pencil" [size]="14"></span>
                  </button>
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Remove" (click)="removeMember(member)">
                    <span appIcon="Trash2" [size]="14"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      @if (showCreate()) {
        <app-modal title="Invite team member" description="Send an invitation to join this workspace." size="md" (close)="closeCreate()">
          <form class="modal-form" [formGroup]="form" (ngSubmit)="invite()">
            <div class="form-grid">
              <label class="field full"><span class="field-label">Link to employee <small class="field-hint">optional</small></span>
                <select formControlName="employeeId" (change)="onEmployeeSelect($any($event.target).value)">
                  <option value="">No linked employee</option>
                  @for (employee of employees(); track employee._id) {
                    <option [value]="employee._id">{{ employee.firstName }} {{ employee.lastName }} · {{ employee.employeeNumber }}</option>
                  }
                </select>
              </label>
              <label class="field"><span class="field-label">Username <small class="field-hint">auto if linked</small></span><input formControlName="username" /></label>
              <label class="field"><span class="field-label">Email <small class="field-hint">auto if linked</small></span><input type="email" formControlName="email" /></label>
              <label class="field full"><span class="field-label">Role <span class="req">*</span></span>
                <select formControlName="roleId">
                  <option value="">Select role</option>
                  @for (role of roles(); track role._id) {
                    <option [value]="role._id">{{ role.name }}</option>
                  }
                </select>
              </label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Cancel</button>
            <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || saving() || (!form.controls.username.value && !form.controls.employeeId.value)" (click)="invite()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Send" [size]="16"></span> }
              Send invite
            </button>
          </div>
        </app-modal>
      }

      @if (showEdit()) {
        <app-modal [title]="'Edit ' + (editing()?.user?.username || 'member')" description="Update role and status for this member." size="md" (close)="closeEdit()">
          <form class="modal-form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Username</span><input formControlName="username" /></label>
              <label class="field"><span class="field-label">Email</span><input type="email" formControlName="email" /></label>
              <label class="field full"><span class="field-label">Role</span>
                <select formControlName="roleId">
                  <option value="">Select role</option>
                  @for (role of roles(); track role._id) {
                    <option [value]="role._id">{{ role.name }}</option>
                  }
                </select>
              </label>
              <label class="field full"><span class="field-label">Status</span>
                <select formControlName="status">
                  <option value="ACTIVE">Active</option>
                  <option value="INVITED">Invited</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeEdit()">Cancel</button>
            <button class="btn btn--primary" type="button" [class.btn--loading]="savingEdit()" [disabled]="editForm.invalid || savingEdit()" (click)="saveEdit()">
              @if (savingEdit()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Save changes
            </button>
          </div>
        </app-modal>
      }
    </section>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1.1fr 1.4fr .8fr .8fr auto; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .row:first-child { border-top: 0; }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .field.full { grid-column: 1 / -1; }
    .field-hint { color: var(--muted); font-size: 11px; font-weight: 400; }
    .credentials-box {
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: var(--surface-soft);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      display: grid;
      gap: var(--space-2);
    }
    .credential-row { display: flex; gap: var(--space-2); align-items: center; }
    .credential-label { color: var(--muted); font-size: 12px; font-weight: 600; min-width: 110px; }
    .credential-value { font-weight: 700; color: var(--ink-strong); }
    .alert-actions { display: flex; gap: var(--space-2); align-items: center; margin-left: auto; }
    @media (max-width: 900px) {
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(2) { display: none; }
      .row.head { display: none; }
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class TeamComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly members = signal<TeamMember[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly showCreate = signal(false);
  readonly showEdit = signal(false);
  readonly editing = signal<TeamMember | null>(null);
  readonly createdMember = signal<{ username: string; tempPassword: string } | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly savingEdit = signal(false);
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly form = this.fb.nonNullable.group({
    employeeId: [''],
    username: [''],
    email: [''],
    roleId: ['', Validators.required]
  });
  readonly editForm = this.fb.nonNullable.group({
    username: [''],
    email: [''],
    roleId: [''],
    status: ['ACTIVE']
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.loadAll());
    });
  }

  loadAll() {
    if (this.loading()) return;
    this.loading.set(true);
    this.load();
    this.api.get<Role[]>('/roles').subscribe({ next: (roles) => this.roles.set(roles) });
    this.api.get<Employee[]>('/employees').subscribe({ next: (employees) => this.employees.set(employees) });
  }

  load() {
    this.api.get<TeamMember[]>('/team').subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.members.set([]);
        this.loading.set(false);
      }
    });
  }

  openCreate() {
    this.form.reset({ employeeId: '', username: '', email: '', roleId: '' });
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  onEmployeeSelect(employeeId: string) {
    if (!employeeId) {
      this.form.controls.username.setValue('');
      this.form.controls.email.setValue('');
      return;
    }
    const employee = this.employees().find((e) => e._id === employeeId);
    if (!employee) return;
    // Auto-fill username and email from employee data
    const username = `${employee.firstName}.${employee.lastName}`.toLowerCase().replace(/\s+/g, '');
    this.form.controls.username.setValue(username);
    if (employee.email) {
      this.form.controls.email.setValue(employee.email);
    }
  }

  invite() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    // Require either employeeId or both username+email
    if (!value.employeeId && (!value.username || !value.email)) return;
    this.saving.set(true);
    this.api.post<{ tempPassword: string; username: string }>('/team/invitations', value).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.createdMember.set({
          username: response.username || value.username,
          tempPassword: response.tempPassword
        });
        this.form.reset({ employeeId: '', username: '', email: '', roleId: '' });
        this.showCreate.set(false);
        this.toasts.success('Team member created.');
        this.loadAll();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not create invitation.');
      }
    });
  }

  openEdit(member: TeamMember) {
    this.editing.set(member);
    this.editForm.reset({
      username: member.user?.username ?? '',
      email: member.user?.email ?? '',
      roleId: member.roleId ?? '',
      status: member.status
    });
    this.showEdit.set(true);
  }

  closeEdit() {
    this.showEdit.set(false);
    this.editing.set(null);
  }

  saveEdit() {
    const member = this.editing();
    if (!member || this.editForm.invalid || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.api.patch(`/team/${member.membershipId}`, this.editForm.getRawValue()).subscribe({
      next: () => {
        this.savingEdit.set(false);
        this.closeEdit();
        this.toasts.success('Member updated.');
        this.loadAll();
      },
      error: () => {
        this.savingEdit.set(false);
        this.toasts.error('Could not update member.');
      }
    });
  }

  async removeMember(member: TeamMember) {
    const name = member.user?.username || member.user?.email || 'this member';
    const confirmed = await this.confirm.confirm({
      title: 'Remove team member',
      message: `Are you sure you want to remove ${name} from this workspace?`,
      confirmLabel: 'Remove',
      danger: true
    });
    if (!confirmed) return;
    this.api.delete(`/team/${member.membershipId}`).subscribe({
      next: () => {
        this.toasts.success('Member removed.');
        this.loadAll();
      },
      error: () => {
        this.toasts.error('Could not remove member.');
      }
    });
  }

  copyCredentials() {
    const m = this.createdMember();
    if (!m) return;
    const text = `Username: ${m.username}\nPassword: ${m.tempPassword}`;
    navigator.clipboard?.writeText(text).then(
      () => this.toasts.info('Credentials copied.'),
      () => undefined
    );
  }
}
