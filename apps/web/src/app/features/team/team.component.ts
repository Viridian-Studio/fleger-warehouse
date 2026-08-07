import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

interface TeamMember {
  membershipId: string;
  status: string;
  permissions: string[];
  user?: { username: string; email: string; globalStatus: string };
}

interface Role {
  _id: string;
  name: string;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row"><div class="page-title"><h1>Team</h1><p>{{ members().length }} workspace members.</p></div><button class="primary-button" (click)="showCreate.update(toggle)"><span [appIcon]="showCreate() ? 'X' : 'UserPlus'"></span>{{ showCreate() ? 'Close' : 'Add member' }}</button></div>
      @if (showCreate()) {
        <form class="toolbar-card form" [formGroup]="form" (ngSubmit)="invite()">
          <label class="field"><span>Username</span><input formControlName="username" /></label>
          <label class="field"><span>Email</span><input formControlName="email" /></label>
          <label class="field"><span>Role</span><select formControlName="roleId">
            <option value="">Select role</option>
            @for (role of roles(); track role._id) {
              <option [value]="role._id">{{ role.name }}</option>
            }
          </select></label>
          <button class="primary-button" type="submit" [disabled]="form.invalid"><span appIcon="Send"></span>Send invite</button>
        </form>
      }
      @if (inviteLink()) {
        <p class="notice">{{ inviteLink() }}</p>
      }
      <div class="table-shell">
        <div class="table-title"><h2>Members</h2><span class="status-pill">{{ members().length }} records</span></div>
        <div class="row head"><span>User</span><span>Email</span><span>Status</span><span>Permissions</span></div>
        @if (members().length === 0) {
          <div class="empty-state">No team members yet.</div>
        }
        @for (member of members(); track member.membershipId) {
          <div class="row">
            <strong>{{ member.user?.username || member.user?.email || 'Unknown user' }}</strong>
            <span>{{ member.user?.email }}</span>
            <span class="status-pill" [class.good]="member.status === 'ACTIVE'" [class.info]="member.status === 'INVITED'">{{ member.status }}</span>
            <span>{{ member.permissions.length }} permissions</span>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    h1 { margin: 0; font-size: 28px; }
    .form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
    .notice { margin: 0; color: var(--brand-2); }
    span { color: var(--muted); }
    .row { display: grid; grid-template-columns: 1.1fr 1.4fr .8fr .8fr; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; }
    .row:first-child { border-top: 0; }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; }
    @media (max-width: 1000px) { .form, .row { grid-template-columns: 1fr; } }
  `
})
export class TeamComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly members = signal<TeamMember[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly showCreate = signal(false);
  readonly inviteLink = signal('');
  readonly toggle = (value: boolean) => !value;
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    roleId: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.loadAll();
    });
  }

  loadAll() {
    this.load();
    this.api.get<Role[]>('/roles').subscribe({ next: (roles) => this.roles.set(roles) });
  }

  load() {
    this.api.get<TeamMember[]>('/team').subscribe({
      next: (members) => this.members.set(members),
      error: () => this.members.set([])
    });
  }

  invite() {
    if (this.form.invalid) return;
    this.api.post<{ inviteLink: string }>('/team/invitations', this.form.getRawValue()).subscribe({
      next: (response) => {
        this.inviteLink.set(response.inviteLink);
        this.form.reset({ username: '', email: '', roleId: '' });
        this.showCreate.set(false);
        this.toasts.success('Invitation created.');
        this.loadAll();
      },
      error: () => this.toasts.error('Could not create invitation.')
    });
  }
}
