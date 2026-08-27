import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';

interface Assignment {
  _id: string;
  itemId: string;
  targetType: string;
  targetId: string;
  quantity: number;
  assignedAt: string;
  status: string;
}

interface VehicleAssignment {
  _id: string;
  vehicleId: string;
  employeeId: string;
  assignedAt: string;
  returnedAt?: string;
  mileageAtAssignment: number;
  mileageAtReturn?: number;
  status: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  inventoryNumber: string;
  type: string;
  availableQuantity: number;
  quantity: number;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface Vehicle {
  _id: string;
  licensePlate: string;
  manufacturer: string;
  model: string;
  currentMileage: number;
  status: string;
}

@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [DatePipe, IconDirective, TooltipDirective, ReactiveFormsModule, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Assignments</h1>
          <p>{{ activeAssignments() }} active issues across inventory and fleet.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="loadAll()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
        </div>
      </div>

      <div class="workflow-grid">
        <form class="card issue-panel" [formGroup]="form" (ngSubmit)="createInventoryAssignment()">
          <div class="panel-head">
            <h2><span class="panel-icon brand" appIcon="PackageCheck" [size]="18"></span>Inventory issue</h2>
            <span class="badge badge--info">{{ availableItemCount() }} available</span>
          </div>
          <label class="field"><span class="field-label">Item</span>
            <select formControlName="itemId">
              <option value="">Select item</option>
              @for (item of availableItems(); track item._id) {
                <option [value]="item._id">{{ item.name }} · {{ item.inventoryNumber }} · {{ item.availableQuantity }} / {{ item.quantity }}</option>
              }
            </select>
          </label>
          <div class="split">
            <label class="field"><span class="field-label">Issue to</span>
              <select formControlName="targetType"><option value="EMPLOYEE">Employee</option><option value="VEHICLE">Vehicle</option></select>
            </label>
            <label class="field"><span class="field-label">Quantity</span><input type="number" min="1" formControlName="quantity" /></label>
          </div>
          <label class="field"><span class="field-label">Target</span>
            <select formControlName="targetId">
              <option value="">Select target</option>
              @if (form.controls.targetType.value === 'EMPLOYEE') {
                @for (employee of employees(); track employee._id) {
                  <option [value]="employee._id">{{ employee.lastName }} {{ employee.firstName }} · {{ employee.employeeNumber }}</option>
                }
              } @else {
                @for (vehicle of vehicles(); track vehicle._id) {
                  <option [value]="vehicle._id">{{ vehicle.licensePlate }} · {{ vehicle.manufacturer }} {{ vehicle.model }}</option>
                }
              }
            </select>
          </label>
          <button class="btn btn--primary" type="submit" [class.btn--loading]="savingInv()" [disabled]="form.invalid || savingInv()">
            @if (savingInv()) { <span class="spinner"></span> } @else { <span appIcon="Send" [size]="16"></span> }
            Issue inventory
          </button>
        </form>

        <form class="card issue-panel" [formGroup]="vehicleForm" (ngSubmit)="createVehicleAssignment()">
          <div class="panel-head">
            <h2><span class="panel-icon info" appIcon="Truck" [size]="18"></span>Vehicle issue</h2>
            <span class="badge badge--good">{{ availableVehicleCount() }} ready</span>
          </div>
          <label class="field"><span class="field-label">Vehicle</span>
            <select formControlName="vehicleId">
              <option value="">Select vehicle</option>
              @for (vehicle of availableVehicles(); track vehicle._id) {
                <option [value]="vehicle._id">{{ vehicle.licensePlate }} · {{ vehicle.manufacturer }} {{ vehicle.model }} · {{ vehicle.currentMileage }} km</option>
              }
            </select>
          </label>
          <label class="field"><span class="field-label">Employee</span>
            <select formControlName="employeeId">
              <option value="">Select employee</option>
              @for (employee of employees(); track employee._id) {
                <option [value]="employee._id">{{ employee.lastName }} {{ employee.firstName }} · {{ employee.employeeNumber }}</option>
              }
            </select>
          </label>
          <label class="field"><span class="field-label">Mileage</span><input type="number" min="0" formControlName="mileageAtAssignment" /></label>
          <button class="btn btn--secondary" type="submit" [class.btn--loading]="savingVeh()" [disabled]="vehicleForm.invalid || savingVeh()">
            @if (savingVeh()) { <span class="spinner"></span> } @else { <span appIcon="KeyRound" [size]="16"></span> }
            Issue vehicle
          </button>
        </form>
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Inventory history</h2><span class="table-meta">{{ assignments().length }} records</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 26%"></span>
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 10%"></span>
                  <span class="skeleton skeleton--line" style="width: 16%"></span>
                </div>
              }
            </div>
          } @else if (assignments().length === 0) {
            <app-empty-state icon="ClipboardCheck" title="No inventory assignments yet" description="Issue inventory to employees or vehicles to see the history here."></app-empty-state>
          } @else {
            <div class="row head"><span>Item</span><span>Target</span><span>Qty</span><span>Status</span><span>Assigned</span><span></span></div>
            @for (assignment of assignments(); track assignment._id) {
              <div class="row">
                <span class="col-strong truncate">{{ itemName(assignment.itemId) }}</span>
                <span class="truncate">{{ targetName(assignment.targetType, assignment.targetId) }}</span>
                <span class="col-muted">{{ assignment.quantity }}</span>
                <span class="badge" [class.badge--good]="assignment.status === 'ACTIVE'" [class.badge--muted]="assignment.status !== 'ACTIVE'">{{ assignment.status }}</span>
                <span class="col-muted">{{ assignment.assignedAt | date: 'yyyy-MM-dd HH:mm' }}</span>
                <span class="row-actions">
                  <button class="btn--icon btn--subtle btn--sm" type="button" [disabled]="assignment.status !== 'ACTIVE'" appTooltip="Return" (click)="returnAssignment(assignment._id)">
                    <span appIcon="Undo2" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Vehicle history</h2><span class="table-meta">{{ vehicleAssignments().length }} records</span></div>
        <div class="table-scroll">
          @if (loading()) {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 26%"></span>
                  <span class="skeleton skeleton--line" style="width: 22%"></span>
                  <span class="skeleton skeleton--line" style="width: 16%"></span>
                </div>
              }
            </div>
          } @else if (vehicleAssignments().length === 0) {
            <app-empty-state icon="Truck" title="No vehicle assignments yet" description="Issue vehicles to employees to see the history here."></app-empty-state>
          } @else {
            <div class="vehicle-row head"><span>Vehicle</span><span>Employee</span><span>Mileage</span><span>Status</span><span>Assigned</span><span></span></div>
            @for (assignment of vehicleAssignments(); track assignment._id) {
              <div class="vehicle-row">
                <span class="col-strong truncate">{{ vehicleName(assignment.vehicleId) }}</span>
                <span class="truncate">{{ employeeName(assignment.employeeId) }}</span>
                <span class="col-muted">{{ assignment.mileageAtAssignment.toLocaleString() }}{{ assignment.mileageAtReturn ? ' → ' + assignment.mileageAtReturn.toLocaleString() : '' }} km</span>
                <span class="badge" [class.badge--good]="assignment.status === 'ACTIVE'" [class.badge--muted]="assignment.status !== 'ACTIVE'">{{ assignment.status }}</span>
                <span class="col-muted">{{ assignment.assignedAt | date: 'yyyy-MM-dd HH:mm' }}</span>
                <span class="row-actions">
                  <button class="btn--icon btn--subtle btn--sm" type="button" [disabled]="assignment.status !== 'ACTIVE'" appTooltip="Return" (click)="returnVehicleAssignment(assignment._id)">
                    <span appIcon="RotateCcw" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .workflow-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
    .issue-panel { display: grid; gap: var(--space-4); padding: var(--space-5); }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .panel-head h2 { display: flex; align-items: center; gap: var(--space-2); font-size: 16px; }
    .panel-icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); }
    .panel-icon.brand { background: var(--brand-soft); color: var(--brand-ink); }
    .panel-icon.info { background: var(--info-soft); color: var(--info); }
    .split { display: grid; grid-template-columns: 1fr 120px; gap: var(--space-3); }

    .row { display: grid; grid-template-columns: 1fr 1.3fr .4fr .7fr .9fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .vehicle-row { display: grid; grid-template-columns: 1fr 1fr .8fr .7fr .9fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child, .vehicle-row:first-child { border-top: 0; }
    .row.head, .vehicle-row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    @media (max-width: 1000px) {
      .workflow-grid, .split, .row, .vehicle-row { grid-template-columns: 1fr; }
    }
  `]
})
export class AssignmentsComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly assignments = signal<Assignment[]>([]);
  readonly vehicleAssignments = signal<VehicleAssignment[]>([]);
  readonly items = signal<InventoryItem[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly loading = signal(false);
  readonly savingInv = signal(false);
  readonly savingVeh = signal(false);
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly form = this.fb.nonNullable.group({
    itemId: ['', Validators.required],
    targetType: ['EMPLOYEE', Validators.required],
    targetId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });
  readonly vehicleForm = this.fb.nonNullable.group({
    vehicleId: ['', Validators.required],
    employeeId: ['', Validators.required],
    mileageAtAssignment: [0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.loadAll());
    });

    this.form.controls.targetType.valueChanges.subscribe(() => {
      this.form.controls.targetId.setValue('');
    });

    this.vehicleForm.controls.vehicleId.valueChanges.subscribe((vehicleId) => {
      const vehicle = this.vehicles().find((item) => item._id === vehicleId);
      if (vehicle) this.vehicleForm.controls.mileageAtAssignment.setValue(vehicle.currentMileage);
    });
  }

  loadAll() {
    if (this.loading()) return;
    this.load();
    this.api.get<InventoryItem[]>('/inventory/items').subscribe({ next: (items) => this.items.set(items) });
    this.api.get<Employee[]>('/employees').subscribe({ next: (employees) => this.employees.set(employees) });
    this.api.get<Vehicle[]>('/vehicles').subscribe({ next: (vehicles) => this.vehicles.set(vehicles) });
  }

  load() {
    this.loading.set(true);
    this.api.get<Assignment[]>('/assignments').subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: () => {
        this.assignments.set([]);
        this.loading.set(false);
      }
    });
    this.api.get<VehicleAssignment[]>('/assignments/vehicles').subscribe({
      next: (assignments) => this.vehicleAssignments.set(assignments),
      error: () => this.vehicleAssignments.set([])
    });
  }

  createInventoryAssignment() {
    if (this.form.invalid || this.savingInv()) return;
    this.savingInv.set(true);
    this.api.post('/assignments/inventory', this.form.getRawValue()).subscribe({
      next: () => {
        this.savingInv.set(false);
        this.form.reset({ itemId: '', targetType: 'EMPLOYEE', targetId: '', quantity: 1 });
        this.toasts.success('Inventory issued.');
        this.loadAll();
      },
      error: () => {
        this.savingInv.set(false);
        this.toasts.error('Inventory issue failed.');
      }
    });
  }

  returnAssignment(id: string) {
    this.api.post(`/assignments/inventory/${id}/return`, {}).subscribe({
      next: () => {
        this.toasts.success('Inventory returned.');
        this.load();
      },
      error: () => this.toasts.error('Inventory return failed.')
    });
  }

  createVehicleAssignment() {
    if (this.vehicleForm.invalid || this.savingVeh()) return;
    this.savingVeh.set(true);
    this.api.post('/assignments/vehicles', this.vehicleForm.getRawValue()).subscribe({
      next: () => {
        this.savingVeh.set(false);
        this.vehicleForm.reset({ vehicleId: '', employeeId: '', mileageAtAssignment: 0 });
        this.toasts.success('Vehicle issued.');
        this.loadAll();
      },
      error: () => {
        this.savingVeh.set(false);
        this.toasts.error('Vehicle issue failed.');
      }
    });
  }

  returnVehicleAssignment(id: string) {
    this.api.post(`/assignments/vehicles/${id}/return`, {}).subscribe({
      next: () => {
        this.toasts.success('Vehicle returned.');
        this.loadAll();
      },
      error: () => this.toasts.error('Vehicle return failed.')
    });
  }

  employeeName(id: string) {
    const employee = this.employees().find((item) => item._id === id);
    return employee ? `${employee.lastName} ${employee.firstName}` : id;
  }

  vehicleName(id: string) {
    const vehicle = this.vehicles().find((item) => item._id === id);
    return vehicle ? `${vehicle.licensePlate} · ${vehicle.manufacturer} ${vehicle.model}` : id;
  }

  itemName(id: string) {
    const item = this.items().find((value) => value._id === id);
    return item ? `${item.name} · ${item.inventoryNumber}` : id;
  }

  targetName(type: string, id: string) {
    return type === 'EMPLOYEE' ? this.employeeName(id) : this.vehicleName(id);
  }

  availableItems() {
    return this.items().filter((item) => item.availableQuantity > 0);
  }

  availableVehicles() {
    return this.vehicles().filter((vehicle) => vehicle.status === 'AVAILABLE');
  }

  availableItemCount() {
    return this.availableItems().length;
  }

  availableVehicleCount() {
    return this.availableVehicles().length;
  }

  activeAssignments() {
    return this.assignments().filter((item) => item.status === 'ACTIVE').length +
      this.vehicleAssignments().filter((item) => item.status === 'ACTIVE').length;
  }
}
