import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent, AlertComponent } from '../../shared/ui/feedback.component';

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
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent, AlertComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Platform Admin</h1>
          <p>Manage tenants, plans and usage across the platform.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--secondary" type="button" (click)="openCreate()">
            <span appIcon="Plus" [size]="16"></span>Create tenant
          </button>
        </div>
      </div>

      @if (error()) {
        <app-alert variant="error" title="Access restricted">
          {{ error() }}
        </app-alert>
      }

      <div class="table-shell">
        <div class="table-title"><h2>Tenants</h2><span class="table-meta">{{ tenants().length }} records</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                </div>
              }
            </div>
          } @else if (tenants().length === 0 && !error()) {
            <app-empty-state icon="Building2" title="No tenants yet" description="Create your first tenant to get started.">
              <button class="btn btn--secondary" type="button" (click)="openCreate()"><span appIcon="Plus" [size]="16"></span>Create tenant</button>
            </app-empty-state>
          } @else if (tenants().length > 0) {
            <div class="row head"><span>Name</span><span>Slug</span><span>Status</span><span>Plan</span><span></span></div>
            @for (tenant of tenants(); track tenant._id) {
              <div class="row">
                <strong class="truncate">{{ tenant.name }}</strong>
                <span class="col-muted mono truncate">{{ tenant.slug }}</span>
                <select class="inline-select" [value]="tenant.status" (change)="updateStatus(tenant._id, $any($event.target).value)">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DEACTIVATED">Deactivated</option>
                </select>
                <select class="inline-select" [value]="tenant.planCode" (change)="updatePlan(tenant._id, $any($event.target).value)">
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
                <span class="row-actions">
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="View usage" (click)="loadUsage(tenant._id)">
                    <span appIcon="Eye" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      @if (usage(); as u) {
        <div class="card">
          <div class="card-head">
            <h2>Usage</h2>
            <button class="btn--icon btn--subtle btn--sm" type="button" (click)="usage.set('')"><span appIcon="X" [size]="16"></span></button>
          </div>
          <pre class="usage-pre">{{ u }}</pre>
        </div>
      }

      @if (showCreate()) {
        <app-modal title="Create tenant" description="Provision a new tenant on the platform." size="md" (close)="closeCreate()">
          <form class="modal-form" [formGroup]="form" (ngSubmit)="createTenant()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Tenant name <span class="req">*</span></span><input formControlName="name" /></label>
              <label class="field"><span class="field-label">Slug <span class="req">*</span></span><input formControlName="slug" /></label>
              <label class="field full"><span class="field-label">Plan</span>
                <select formControlName="planCode">
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Cancel</button>
            <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || saving()" (click)="createTenant()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Plus" [size]="16"></span> }
              Create tenant
            </button>
          </div>
        </app-modal>
      }
    </section>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 1.2fr 1fr .9fr .9fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .inline-select { width: auto; min-width: 120px; }
    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .field.full { grid-column: 1 / -1; }
    .usage-pre { margin: 0; padding: var(--space-4); background: var(--surface-soft); border-radius: var(--radius); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; overflow: auto; max-height: 400px; }
    @media (max-width: 900px) {
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PlatformAdminComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly tenants = signal<Tenant[]>([]);
  readonly error = signal('');
  readonly usage = signal('');
  readonly showCreate = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    planCode: ['STARTER', Validators.required]
  });

  constructor() {
    this.load();
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.get<Tenant[]>('/platform-admin/tenants').subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Platform admin permission required.');
        this.loading.set(false);
      }
    });
  }

  openCreate() {
    this.form.reset({ name: '', slug: '', planCode: 'STARTER' });
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  async updateStatus(id: string, status: string) {
    const tenant = this.tenants().find((t) => t._id === id);
    const tenantName = tenant?.name ?? 'this tenant';
    const statusLabel = status === 'ACTIVE' ? 'Active' : status === 'SUSPENDED' ? 'Suspended' : 'Deactivated';
    const confirmed = await this.confirm.confirm({
      title: 'Change tenant status?',
      message: `Are you sure you want to set "${tenantName}" to ${statusLabel}?`,
      confirmLabel: 'Confirm',
      danger: status !== 'ACTIVE'
    });
    if (!confirmed) return;
    this.api.patch<Tenant>(`/platform-admin/tenants/${id}/status`, { status }).subscribe({
      next: () => { this.toasts.success('Tenant status updated.'); this.load(); },
      error: () => this.toasts.error('Could not update tenant status.')
    });
  }

  async updatePlan(id: string, planCode: string) {
    const tenant = this.tenants().find((t) => t._id === id);
    const tenantName = tenant?.name ?? 'this tenant';
    const planLabel = planCode === 'STARTER' ? 'Starter' : planCode === 'PRO' ? 'Pro' : 'Enterprise';
    const confirmed = await this.confirm.confirm({
      title: 'Change tenant plan?',
      message: `Are you sure you want to change "${tenantName}" to the ${planLabel} plan?`,
      confirmLabel: 'Confirm'
    });
    if (!confirmed) return;
    this.api.patch<Tenant>(`/platform-admin/tenants/${id}/plan`, { planCode }).subscribe({
      next: () => { this.toasts.success('Tenant plan updated.'); this.load(); },
      error: () => this.toasts.error('Could not update tenant plan.')
    });
  }

  async createTenant() {
    if (this.form.invalid || this.saving()) return;
    const name = this.form.controls.name.value;
    const slug = this.form.controls.slug.value;
    const confirmed = await this.confirm.confirm({
      title: 'Create tenant?',
      message: `Are you sure you want to create "${name}" with slug "${slug}"?`,
      confirmLabel: 'Create tenant'
    });
    if (!confirmed) return;
    this.saving.set(true);
    this.api.post<Tenant>('/platform-admin/tenants', this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreate();
        this.toasts.success('Tenant created.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not create tenant.');
      }
    });
  }

  loadUsage(id: string) {
    this.api.get<unknown>(`/platform-admin/tenants/${id}/usage`).subscribe({
      next: (usage) => this.usage.set(JSON.stringify(usage, null, 2)),
      error: () => this.toasts.error('Could not load usage.')
    });
  }
}
