import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
}

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title"><h1>Platform Admin</h1><p>{{ tenants().length }} tenants.</p></div>
        <button class="ghost-button" (click)="load()"><span appIcon="RefreshCw"></span>Load tenants</button>
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <form class="toolbar-card form" [formGroup]="form" (ngSubmit)="createTenant()">
        <label class="field"><span>Tenant name</span><input formControlName="name" /></label>
        <label class="field"><span>Slug</span><input formControlName="slug" /></label>
        <label class="field"><span>Plan</span><select formControlName="planCode">
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select></label>
        <button class="secondary-button" type="submit" [disabled]="form.invalid"><span appIcon="Plus"></span>Create tenant</button>
      </form>
      <div class="table-shell">
        <div class="table-title"><h2>Tenants</h2><span class="status-pill">{{ tenants().length }} records</span></div>
        <div class="row head"><span>Name</span><span>Slug</span><span>Status</span><span>Plan</span><span></span></div>
        @for (tenant of tenants(); track tenant._id) {
          <div class="row">
            <span>{{ tenant.name }}</span>
            <span>{{ tenant.slug }}</span>
            <select [value]="tenant.status" (change)="updateStatus(tenant._id, $any($event.target).value)">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
            <select [value]="tenant.planCode" (change)="updatePlan(tenant._id, $any($event.target).value)">
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <button class="ghost-button" (click)="loadUsage(tenant._id)">Usage</button>
          </div>
        }
      </div>
      @if (usage()) {
        <pre class="data-card">{{ usage() }}</pre>
      }
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 18px; }
    .form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
    .error { color: #b42318; margin: 0; }
    .row { display: grid; grid-template-columns: 1.2fr 1fr .8fr .8fr 90px; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; }
    .row:first-child { border-top: 0; }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; }
    pre { white-space: pre-wrap; margin: 0; }
    @media (max-width: 1000px) { .form, .row { grid-template-columns: 1fr; } }
  `
})
export class PlatformAdminComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly tenants = signal<Tenant[]>([]);
  readonly error = signal('');
  readonly usage = signal('');
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    planCode: ['STARTER', Validators.required]
  });

  constructor() {
    this.load();
  }

  load() {
    this.error.set('');
    this.api.get<Tenant[]>('/platform-admin/tenants').subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: () => this.error.set('Platform admin jogosultsag szukseges.')
    });
  }

  createTenant() {
    if (this.form.invalid) return;
    this.api.post<Tenant>('/platform-admin/tenants', this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ name: '', slug: '', planCode: 'STARTER' });
        this.toasts.success('Tenant created.');
        this.load();
      },
      error: () => this.toasts.error('Could not create tenant.')
    });
  }

  updateStatus(id: string, status: string) {
    this.api.patch<Tenant>(`/platform-admin/tenants/${id}/status`, { status }).subscribe({ next: () => { this.toasts.success('Tenant status updated.'); this.load(); } });
  }

  updatePlan(id: string, planCode: string) {
    this.api.patch<Tenant>(`/platform-admin/tenants/${id}/plan`, { planCode }).subscribe({ next: () => { this.toasts.success('Tenant plan updated.'); this.load(); } });
  }

  loadUsage(id: string) {
    this.api.get<unknown>(`/platform-admin/tenants/${id}/usage`).subscribe({
      next: (usage) => this.usage.set(JSON.stringify(usage, null, 2))
    });
  }
}
