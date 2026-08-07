import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

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

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Employees</h1>
          <p>{{ activeCount() }} active, {{ disabledCount() }} disabled, {{ departments().length }} departments.</p>
        </div>
        <button class="primary-button" (click)="startCreate()"><span appIcon="UserPlus"></span>Add employee</button>
      </div>

      <div class="toolbar-card department-panel">
        <div class="panel-head">
          <div>
            <h2><span appIcon="Building2"></span> Departments</h2>
            <p>Create departments here, then assign them while adding employees.</p>
          </div>
          <span class="status-pill">{{ departments().length }} records</span>
        </div>
        <form class="department-form" [formGroup]="departmentForm" (ngSubmit)="createDepartment()">
          <label class="field"><span>Name</span><input formControlName="name" placeholder="Example: Warehouse" /></label>
          <label class="field"><span>Code</span><input formControlName="code" placeholder="RKT" /></label>
          <button class="secondary-button" type="submit" [disabled]="departmentForm.invalid"><span appIcon="Plus"></span>Add department</button>
        </form>
        <div class="department-list">
          @if (departments().length === 0) {
            <span class="empty-inline">No departments yet.</span>
          }
          @for (department of departments(); track department._id) {
            <span class="department-chip">
              <strong>{{ department.name }}</strong>
              @if (department.code) {
                <small>{{ department.code }}</small>
              }
              <button class="chip-action" type="button" title="Delete department" (click)="removeDepartment(department)">
                <span appIcon="Trash2" [size]="14"></span>
              </button>
            </span>
          }
        </div>
      </div>

      @if (showCreate()) {
        <form class="toolbar-card employee-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="form-head">
            <div>
              <span class="eyebrow">{{ editing() ? 'Edit employee' : 'New employee' }}</span>
              <h2>{{ editing() ? editing()?.lastName + ' ' + editing()?.firstName : 'Employee details' }}</h2>
            </div>
            <button class="icon-button" type="button" title="Close" (click)="cancelForm()"><span appIcon="X"></span></button>
          </div>
          <div class="form">
          <label class="field"><span>Number</span><input formControlName="employeeNumber" /></label>
          <label class="field"><span>First name</span><input formControlName="firstName" /></label>
          <label class="field"><span>Last name</span><input formControlName="lastName" /></label>
          <label class="field"><span>Email</span><input formControlName="email" /></label>
          <label class="field">
            <span>Department</span>
            <select formControlName="departmentId">
              <option value="">Select department</option>
              @for (department of activeDepartments(); track department._id) {
                <option [value]="department._id">{{ department.name }}{{ department.code ? ' · ' + department.code : '' }}</option>
              }
            </select>
          </label>
          <label class="field"><span>Position</span><input formControlName="position" /></label>
          <button class="primary-button" type="submit" [disabled]="form.invalid"><span appIcon="Save"></span>{{ editing() ? 'Update employee' : 'Save employee' }}</button>
          </div>
        </form>
      }

      <div class="table-shell">
        <div class="table-title"><h2>Employee list</h2><span class="status-pill">{{ employees().length }} records</span></div>
        <div class="row head"><span>Name</span><span>Number</span><span>Department</span><span>Position</span><span>Email</span><span>Status</span><span></span></div>
        @if (employees().length === 0) {
          <div class="empty-state">No employees yet.</div>
        }
        @for (employee of employees(); track employee._id) {
          <div class="row" [class.selected]="selected()?._id === employee._id" (click)="select(employee)">
            <strong>{{ employee.lastName }} {{ employee.firstName }}</strong>
            <span>{{ employee.employeeNumber }}</span>
            <span>{{ employee.department || '-' }}</span>
            <span>{{ employee.position || '-' }}</span>
            <span>{{ employee.email || '-' }}</span>
            <span class="status-pill" [class.good]="employee.active">{{ employee.active ? 'ACTIVE' : 'DISABLED' }}</span>
            <button class="ghost-button" type="button" (click)="edit(employee); $event.stopPropagation()"><span appIcon="Settings"></span>Edit</button>
          </div>
        }
      </div>

      @if (selected()) {
        <aside class="preview data-card">
          <div class="title-row"><h2>{{ selected()?.lastName }} {{ selected()?.firstName }}</h2><button class="ghost-button" (click)="selected.set(null)">Close</button></div>
          <dl>
            <dt>Number</dt><dd>{{ selected()?.employeeNumber }}</dd>
            <dt>Email</dt><dd>{{ selected()?.email || '-' }}</dd>
            <dt>Department</dt><dd>{{ selected()?.department || '-' }}</dd>
            <dt>Position</dt><dd>{{ selected()?.position || '-' }}</dd>
            <dt>Status</dt><dd>{{ selected()?.active ? 'Active' : 'Disabled' }}</dd>
          </dl>
          <div class="actions">
            <button class="ghost-button" (click)="edit(selected()!)"><span appIcon="Settings"></span>Edit</button>
            <button class="danger-button" (click)="remove(selected()!._id)"><span appIcon="Trash2"></span>Delete</button>
            @if (selected()?.active) {
              <button class="danger-button" (click)="disable(selected()!._id)"><span appIcon="UserX"></span>Disable</button>
            } @else {
              <button class="primary-button" (click)="reactivate(selected()!._id)"><span appIcon="UserCheck"></span>Reactivate</button>
            }
          </div>
        </aside>
      }
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 20px; }
    .department-panel { display: grid; gap: 14px; }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .panel-head h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-head p {
      margin: 4px 0 0;
      color: var(--muted);
    }
    .department-form {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, .7fr) auto;
      gap: 12px;
      align-items: end;
    }
    .department-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 30px;
    }
    .department-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      color: var(--ink);
      padding: 0 10px;
    }
    .chip-action {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--danger);
      padding: 0;
    }
    .chip-action:hover {
      background: var(--danger-soft);
    }
    .department-chip small,
    .empty-inline {
      color: var(--muted);
    }
    .employee-form { display: grid; gap: 14px; }
    .form-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 2px;
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
    .form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; align-items: end; }
    .row { display: grid; grid-template-columns: 1.2fr .8fr 1fr 1fr 1.2fr .8fr 90px; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; cursor: pointer; }
    .row:first-child { border-top: 0; }
    .row.selected { background: var(--brand-soft); }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; cursor: default; }
    span { color: var(--muted); }
    dl { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; margin: 16px 0 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .actions { display: flex; gap: 10px; margin-top: 18px; }
    @media (max-width: 1000px) { .department-form, .form, .row { grid-template-columns: 1fr; } }
  `
})
export class EmployeesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly employees = signal<Employee[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly selected = signal<Employee | null>(null);
  readonly editing = signal<Employee | null>(null);
  readonly showCreate = signal(false);
  readonly departmentForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['']
  });
  readonly form = this.fb.nonNullable.group({
    employeeNumber: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: [''],
    departmentId: [''],
    position: ['']
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  load() {
    this.api.get<Employee[]>('/employees').subscribe({
      next: (employees) => this.employees.set(employees),
      error: () => undefined
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

  removeDepartment(department: Department) {
    if (!window.confirm(`Delete department "${department.name}"?`)) return;
    this.api.delete<Department>(`/departments/${department._id}`).subscribe({
      next: () => {
        this.toasts.success('Department deleted.');
        if (this.form.controls.departmentId.value === department._id) {
          this.form.controls.departmentId.setValue('');
        }
        this.load();
      },
      error: () => this.toasts.error('Could not delete department.')
    });
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({ employeeNumber: '', firstName: '', lastName: '', email: '', departmentId: '', position: '' });
    this.showCreate.set(true);
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
    this.showCreate.set(true);
  }

  cancelForm() {
    this.showCreate.set(false);
    this.editing.set(null);
    this.form.reset({ employeeNumber: '', firstName: '', lastName: '', email: '', departmentId: '', position: '' });
  }

  save() {
    if (this.form.invalid) return;
    const employee = this.editing();
    const request = employee
      ? this.api.patch<Employee>(`/employees/${employee._id}`, this.form.getRawValue())
      : this.api.post<Employee>('/employees', this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.cancelForm();
        this.toasts.success(employee ? 'Employee updated.' : 'Employee saved.');
        this.load();
      },
      error: () => this.toasts.error(employee ? 'Could not update employee.' : 'Could not save employee.')
    });
  }

  select(employee: Employee) {
    this.api.get<Employee>(`/employees/${employee._id}`).subscribe({ next: (fresh) => this.selected.set(fresh) });
  }

  disable(id: string) {
    this.api.post<Employee>(`/employees/${id}/disable`, {}).subscribe({ next: (employee) => this.afterStatusChange(employee) });
  }

  reactivate(id: string) {
    this.api.post<Employee>(`/employees/${id}/reactivate`, {}).subscribe({ next: (employee) => this.afterStatusChange(employee) });
  }

  remove(id: string) {
    if (!window.confirm('Delete this employee?')) return;
    this.api.delete<Employee>(`/employees/${id}`).subscribe({
      next: () => {
        this.selected.set(null);
        this.cancelForm();
        this.toasts.success('Employee deleted.');
        this.load();
      },
      error: () => this.toasts.error('Could not delete employee.')
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
}
