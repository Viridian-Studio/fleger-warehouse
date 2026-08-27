import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';
import { printLabel } from '../../shared/ui/print-label';

interface Employee {
  _id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  departmentId?: string;
  department?: string;
  position?: string;
  active: boolean;
}

interface Department {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  active: boolean;
}

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Employees</h1>
          <p>{{ activeCount() }} active · {{ disabledCount() }} disabled · {{ departments().length }} departments</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--primary" type="button" (click)="startCreate()">
            <span appIcon="UserPlus" [size]="16"></span>Add employee
          </button>
        </div>
      </div>

      <div class="metrics">
        <article class="mini-metric">
          <span class="mini-icon" appIcon="Users" [size]="18"></span>
          <div><small>Total</small><strong>{{ employees().length }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon good" appIcon="UserCheck" [size]="18"></span>
          <div><small>Active</small><strong>{{ activeCount() }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon warn" appIcon="UserX" [size]="18"></span>
          <div><small>Disabled</small><strong>{{ disabledCount() }}</strong></div>
        </article>
      </div>

      <!-- Departments -->
      <section class="card card--flush">
        <div class="card-head">
          <div>
            <h2><span appIcon="Building2" [size]="18"></span> Departments</h2>
            <p>Create departments here, then assign them while adding employees.</p>
          </div>
          <span class="badge badge--muted">{{ departments().length }} records</span>
        </div>
        <div class="card-body dept-body">
          <form class="department-form" [formGroup]="departmentForm" (ngSubmit)="createDepartment()">
            <label class="field"><span class="field-label">Name</span><input formControlName="name" placeholder="Example: Warehouse" /></label>
            <label class="field"><span class="field-label">Code</span><input formControlName="code" placeholder="RKT" /></label>
            <button class="btn btn--secondary" type="submit" [disabled]="departmentForm.invalid" appTooltip="Add department">
              <span appIcon="Plus" [size]="16"></span>Add
            </button>
          </form>
          <div class="department-list">
            @if (departments().length === 0) {
              <span class="empty-inline">No departments yet.</span>
            }
            @for (department of departments(); track department._id) {
              <span class="chip">
                <strong>{{ department.name }}</strong>
                @if (department.code) { <small>{{ department.code }}</small> }
                <button class="chip-action" type="button" appTooltip="Delete department" (click)="removeDepartment(department)">
                  <span appIcon="Trash2" [size]="14"></span>
                </button>
              </span>
            }
          </div>
        </div>
      </section>

      <!-- Employee table -->
      <div class="table-shell">
        <div class="table-title">
          <h2>Employee list</h2>
          <span class="table-meta">{{ employees().length }} records</span>
        </div>
        <div class="table-scroll">
          @if (state() === 'loading') {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 16%"></span>
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 12%"></span>
                </div>
              }
            </div>
          } @else if (state() === 'error') {
            <div class="state-card is-error">
              <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
              <h3>Couldn't load employees</h3>
              <p>Something went wrong while fetching the employee list. Please try again.</p>
              <button class="btn btn--ghost" type="button" (click)="load()"><span appIcon="RefreshCw" [size]="16"></span>Try again</button>
            </div>
          } @else if (employees().length === 0) {
            <app-empty-state icon="Users" title="No employees yet" description="Add your first employee to start managing your workforce.">
              <button class="btn btn--primary" type="button" (click)="startCreate()"><span appIcon="UserPlus" [size]="16"></span>Add employee</button>
            </app-empty-state>
          } @else {
            <div class="row head">
              <span>Name</span><span>Number</span><span>Department</span><span>Position</span><span>Email</span><span>Status</span><span></span>
            </div>
            @for (employee of employees(); track employee._id) {
              <div class="row" (click)="select(employee)">
                <strong class="truncate">{{ employee.lastName }} {{ employee.firstName }}</strong>
                <span class="col-muted mono">{{ employee.employeeNumber }}</span>
                <span class="col-muted truncate">{{ employee.department || '-' }}</span>
                <span class="truncate">{{ employee.position || '-' }}</span>
                <span class="col-muted truncate">{{ employee.email || '-' }}</span>
                <span class="badge" [class.badge--good]="employee.active" [class.badge--muted]="!employee.active">{{ employee.active ? 'Active' : 'Disabled' }}</span>
                <span class="row-actions" (click)="$event.stopPropagation()">
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="edit(employee)">
                    <span appIcon="Pencil" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      <!-- Create / edit modal -->
      @if (showForm()) {
        <app-modal [title]="editing() ? 'Edit employee' : 'New employee'" [description]="editing() ? (editing()?.lastName + ' ' + editing()?.firstName) : 'Add a new employee to the workspace.'" size="md" (close)="cancelForm()">
          <form class="modal-form" [formGroup]="form" (ngSubmit)="save()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Number <small class="field-hint">auto-generated if empty</small></span><input formControlName="employeeNumber" placeholder="e.g. ACM-EMP-0001" /></label>
              <label class="field"><span class="field-label">First name <span class="req">*</span></span><input formControlName="firstName" /></label>
              <label class="field"><span class="field-label">Last name <span class="req">*</span></span><input formControlName="lastName" /></label>
              <label class="field"><span class="field-label">Email</span><input formControlName="email" type="email" /></label>
              <label class="field"><span class="field-label">Department</span>
                <select formControlName="departmentId">
                  <option value="">Select department</option>
                  @for (department of activeDepartments(); track department._id) {
                    <option [value]="department._id">{{ department.name }}{{ department.code ? ' · ' + department.code : '' }}</option>
                  }
                </select>
              </label>
              <label class="field"><span class="field-label">Position</span><input formControlName="position" /></label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="cancelForm()">Cancel</button>
            <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || saving()" (click)="save()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              {{ editing() ? 'Update employee' : 'Save employee' }}
            </button>
          </div>
        </app-modal>
      }

      <!-- Detail modal -->
      @if (selected(); as emp) {
        <app-modal [title]="emp.lastName + ' ' + emp.firstName" [description]="emp.employeeNumber" size="sm" (close)="selected.set(null)">
          <dl class="detail-dl">
            <dt>Number</dt><dd class="mono">{{ emp.employeeNumber }}</dd>
            <dt>Email</dt><dd>{{ emp.email || '-' }}</dd>
            <dt>Department</dt><dd>{{ emp.department || '-' }}</dd>
            <dt>Position</dt><dd>{{ emp.position || '-' }}</dd>
            <dt>Status</dt><dd><span class="badge" [class.badge--good]="emp.active" [class.badge--muted]="!emp.active">{{ emp.active ? 'Active' : 'Disabled' }}</span></dd>
          </dl>
          <div slot="footer" class="modal-foot modal-foot--between">
            <div class="cluster">
              <button class="btn btn--danger" type="button" [class.btn--loading]="deleting()" (click)="remove(emp._id)">
                @if (deleting()) { <span class="spinner"></span> } @else { <span appIcon="Trash2" [size]="16"></span> }
                Delete
              </button>
              <button class="btn btn--ghost" type="button" (click)="printEmployee(emp)">
                <span appIcon="Printer" [size]="16"></span>
                Print label
              </button>
            </div>
            <div class="cluster">
              @if (emp.active) {
                <button class="btn btn--ghost" type="button" (click)="disable(emp._id)"><span appIcon="UserX" [size]="16"></span>Disable</button>
              } @else {
                <button class="btn btn--ghost" type="button" (click)="reactivate(emp._id)"><span appIcon="UserCheck" [size]="16"></span>Reactivate</button>
              }
              <button class="btn btn--primary" type="button" (click)="edit(emp); selected.set(null)"><span appIcon="Pencil" [size]="16"></span>Edit</button>
            </div>
          </div>
        </app-modal>
      }
    </section>
  `,
  styles: [`
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
    .mini-metric {
      display: flex; align-items: center; gap: var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius);
      background: var(--surface); box-shadow: var(--shadow-sm);
      padding: var(--space-4);
    }
    .mini-icon {
      display: grid; place-items: center; width: 36px; height: 36px;
      border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink);
    }
    .mini-icon.good { background: var(--success-soft); color: var(--success); }
    .mini-icon.warn { background: var(--warn-soft); color: var(--warn); }
    .mini-metric small { color: var(--muted); display: block; font-size: 13px; }
    .mini-metric strong { font-size: 22px; font-weight: 700; color: var(--ink-strong); }

    .dept-body { display: grid; gap: var(--space-4); }
    .department-form { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .7fr) auto; gap: var(--space-3); align-items: end; }
    .department-list { display: flex; flex-wrap: wrap; gap: var(--space-2); min-height: 30px; }

    .row { display: grid; grid-template-columns: 1.2fr .8fr 1fr 1fr 1.2fr .8fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row:not(.head) { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .row:not(.head):hover { background: var(--surface-hover); }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }

    .detail-dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); margin: 0; }
    .detail-dl dt { color: var(--muted); font-size: 13px; font-weight: 600; }
    .detail-dl dd { margin: 0; font-size: 14px; }

    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr; }
      .department-form, .form-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3), .row span:nth-child(4), .row span:nth-child(5) { display: none; }
      .row.head { display: none; }
    }
  `]
})
export class EmployeesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly employees = signal<Employee[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly selected = signal<Employee | null>(null);
  readonly editing = signal<Employee | null>(null);
  readonly showForm = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly departmentForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['']
  });
  readonly form = this.fb.nonNullable.group({
    employeeNumber: [''],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: [''],
    departmentId: [''],
    position: ['']
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
    this.state.set('loading');
    this.api.get<Employee[]>('/employees').subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
        this.state.set('ready');
      },
      error: () => {
        this.loading.set(false);
        this.state.set('error');
      }
    });
    this.api.get<Department[]>('/departments').subscribe({
      next: (departments) => this.departments.set(departments),
      error: () => this.departments.set([])
    });
  }

  createDepartment() {
    if (this.departmentForm.invalid) return;
    this.api.post<Department>('/departments', this.departmentForm.getRawValue()).subscribe({
      next: () => {
        this.departmentForm.reset({ name: '', code: '' });
        this.toasts.success('Department created.');
        this.load();
      },
      error: () => this.toasts.error('Could not create department.')
    });
  }

  async removeDepartment(department: Department) {
    const ok = await this.confirm.confirm({
      title: `Delete department "${department.name}"?`,
      message: 'Employees assigned to this department will lose their department reference. This action cannot be undone.',
      confirmLabel: 'Delete department',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.confirm.setLoading(true);
    this.api.delete<Department>(`/departments/${department._id}`).subscribe({
      next: () => {
        this.confirm.setLoading(false);
        this.toasts.success('Department deleted.');
        if (this.form.controls.departmentId.value === department._id) {
          this.form.controls.departmentId.setValue('');
        }
        this.load();
      },
      error: () => {
        this.confirm.setLoading(false);
        this.toasts.error('Could not delete department.');
      }
    });
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({ employeeNumber: '', firstName: '', lastName: '', email: '', departmentId: '', position: '' });
    this.showForm.set(true);
  }

  edit(employee: Employee) {
    this.editing.set(employee);
    this.form.reset({
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email ?? '',
      departmentId: employee.departmentId ?? '',
      position: employee.position ?? ''
    });
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editing.set(null);
    this.form.reset({ employeeNumber: '', firstName: '', lastName: '', email: '', departmentId: '', position: '' });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const employee = this.editing();
    const request = employee
      ? this.api.patch<Employee>(`/employees/${employee._id}`, this.form.getRawValue())
      : this.api.post<Employee>('/employees', this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.toasts.success(employee ? 'Employee updated.' : 'Employee saved.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error(employee ? 'Could not update employee.' : 'Could not save employee.');
      }
    });
  }

  select(employee: Employee) {
    this.api.get<Employee>(`/employees/${employee._id}`).subscribe({ next: (fresh) => this.selected.set(fresh) });
  }

  disable(id: string) {
    this.api.post<Employee>(`/employees/${id}/disable`, {}).subscribe({
      next: (employee) => this.afterStatusChange(employee),
      error: () => this.toasts.error('Could not disable employee.')
    });
  }

  reactivate(id: string) {
    this.api.post<Employee>(`/employees/${id}/reactivate`, {}).subscribe({
      next: (employee) => this.afterStatusChange(employee),
      error: () => this.toasts.error('Could not reactivate employee.')
    });
  }

  async remove(id: string) {
    const ok = await this.confirm.confirm({
      title: 'Delete employee?',
      message: 'This will permanently remove the employee record. This action cannot be undone.',
      confirmLabel: 'Delete employee',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.deleting.set(true);
    this.confirm.setLoading(true);
    this.api.delete<Employee>(`/employees/${id}`).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.selected.set(null);
        this.cancelForm();
        this.toasts.success('Employee deleted.');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.toasts.error('Could not delete employee.');
      }
    });
  }

  activeCount() {
    return this.employees().filter((employee) => employee.active).length;
  }

  disabledCount() {
    return this.employees().filter((employee) => !employee.active).length;
  }

  activeDepartments() {
    return this.departments().filter((department) => department.active);
  }

  private afterStatusChange(employee: Employee) {
    this.selected.set(employee);
    this.toasts.success('Employee status updated.');
    this.load();
  }

  printEmployee(emp: Employee) {
    printLabel({
      number: emp.employeeNumber,
      title: 'Employee',
      subtitle: `${emp.firstName} ${emp.lastName}`,
      meta: [
        { label: 'Department', value: emp.department ?? '-' },
        { label: 'Position', value: emp.position ?? '-' }
      ]
    });
  }
}
