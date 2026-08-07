import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

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
  imports: [DatePipe, IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Assignments</h1>
          <p>{{ activeAssignments() }} active issues across inventory and fleet.</p>
        </div>
        <button class="ghost-button" (click)="loadAll()"><span appIcon="RefreshCw"></span>Refresh</button>
      </div>

      <div class="workflow-grid">
        <form class="toolbar-card issue-panel" [formGroup]="form" (ngSubmit)="createInventoryAssignment()">
          <div class="panel-head">
            <h2><span appIcon="PackageCheck"></span>Inventory issue</h2>
            <span class="status-pill info">{{ availableItemCount() }} available</span>
          </div>
          <label class="field">
            <span>Item</span>
            <select formControlName="itemId">
              <option value="">Select item</option>
              @for (item of availableItems(); track item._id) {
                <option [value]="item._id">{{ item.name }} · {{ item.inventoryNumber }} · {{ item.availableQuantity }} / {{ item.quantity }}</option>
              }
            </select>
          </label>
          <div class="split">
            <label class="field">
              <span>Issue to</span>
              <select formControlName="targetType">
                <option value="EMPLOYEE">Employee</option>
                <option value="VEHICLE">Vehicle</option>
              </select>
            </label>
            <label class="field">
              <span>Quantity</span>
              <input type="number" min="1" formControlName="quantity" />
            </label>
          </div>
          <label class="field">
            <span>Target</span>
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
          <button class="primary-button" type="submit" [disabled]="form.invalid"><span appIcon="Send"></span>Issue inventory</button>
        </form>

        <form class="toolbar-card issue-panel" [formGroup]="vehicleForm" (ngSubmit)="createVehicleAssignment()">
          <div class="panel-head">
            <h2><span appIcon="Truck"></span>Vehicle issue</h2>
            <span class="status-pill good">{{ availableVehicleCount() }} ready</span>
          </div>
          <label class="field">
            <span>Vehicle</span>
            <select formControlName="vehicleId">
              <option value="">Select vehicle</option>
              @for (vehicle of availableVehicles(); track vehicle._id) {
                <option [value]="vehicle._id">{{ vehicle.licensePlate }} · {{ vehicle.manufacturer }} {{ vehicle.model }} · {{ vehicle.currentMileage }} km</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Employee</span>
            <select formControlName="employeeId">
              <option value="">Select employee</option>
              @for (employee of employees(); track employee._id) {
                <option [value]="employee._id">{{ employee.lastName }} {{ employee.firstName }} · {{ employee.employeeNumber }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Mileage</span>
            <input type="number" min="0" formControlName="mileageAtAssignment" />
          </label>
          <button class="secondary-button" type="submit" [disabled]="vehicleForm.invalid"><span appIcon="KeyRound"></span>Issue vehicle</button>
        </form>
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Inventory history</h2><span class="status-pill">{{ assignments().length }} records</span></div>
        <div class="row head"><span>Item</span><span>Target</span><span>Qty</span><span>Status</span><span>Assigned</span><span></span></div>
        @if (!loading() && assignments().length === 0) {
          <div class="empty-state">No inventory assignments yet.</div>
        }
        @for (assignment of assignments(); track assignment._id) {
          <div class="row">
            <span>{{ itemName(assignment.itemId) }}</span>
            <span>{{ targetName(assignment.targetType, assignment.targetId) }}</span>
            <span>{{ assignment.quantity }}</span>
            <span class="status-pill" [class.good]="assignment.status === 'ACTIVE'">{{ assignment.status }}</span>
            <span>{{ assignment.assignedAt | date: 'yyyy-MM-dd HH:mm' }}</span>
            <button class="ghost-button" [disabled]="assignment.status !== 'ACTIVE'" (click)="returnAssignment(assignment._id)"><span appIcon="Undo2"></span>Return</button>
          </div>
        }
      </div>

      <div class="table-shell">
        <div class="table-title"><h2>Vehicle history</h2><span class="status-pill">{{ vehicleAssignments().length }} records</span></div>
        <div class="vehicle-row head"><span>Vehicle</span><span>Employee</span><span>Mileage</span><span>Status</span><span>Assigned</span><span></span></div>
        @if (!loading() && vehicleAssignments().length === 0) {
          <div class="empty-state">No vehicle assignments yet.</div>
        }
        @for (assignment of vehicleAssignments(); track assignment._id) {
          <div class="vehicle-row">
            <span>{{ vehicleName(assignment.vehicleId) }}</span>
            <span>{{ employeeName(assignment.employeeId) }}</span>
            <span>{{ assignment.mileageAtAssignment }}{{ assignment.mileageAtReturn ? ' -> ' + assignment.mileageAtReturn : '' }}</span>
            <span class="status-pill" [class.good]="assignment.status === 'ACTIVE'">{{ assignment.status }}</span>
            <span>{{ assignment.assignedAt | date: 'yyyy-MM-dd HH:mm' }}</span>
            <button class="ghost-button" [disabled]="assignment.status !== 'ACTIVE'" (click)="returnVehicleAssignment(assignment._id)"><span appIcon="RotateCcw"></span>Return</button>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 18px; }
    h2 span { vertical-align: -3px; margin-right: 8px; color: var(--brand); }
    .workflow-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
    .issue-panel { display: grid; gap: 14px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .split { display: grid; grid-template-columns: 1fr 120px; gap: 12px; }
    .row { display: grid; grid-template-columns: 1fr 1.3fr .4fr .7fr .9fr 90px; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; }
    .vehicle-row { display: grid; grid-template-columns: 1fr 1fr .8fr .7fr .9fr 90px; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; }
    .row:first-child { border-top: 0; }
    .vehicle-row:first-child { border-top: 0; }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; }
    .row button, .vehicle-row button { min-height: 32px; }
    button:disabled { opacity: .45; }
    @media (max-width: 1000px) { .workflow-grid, .split, .row, .vehicle-row { grid-template-columns: 1fr; } }
  `
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
      if (this.tenants.activeWorkspace()) this.loadAll();
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
    if (this.form.invalid) return;
    this.api.post('/assignments/inventory', this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ itemId: '', targetType: 'EMPLOYEE', targetId: '', quantity: 1 });
        this.toasts.success('Inventory issued.');
        this.loadAll();
      },
      error: () => this.toasts.error('Inventory issue failed.')
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
    if (this.vehicleForm.invalid) return;
    this.api.post('/assignments/vehicles', this.vehicleForm.getRawValue()).subscribe({
      next: () => {
        this.vehicleForm.reset({ vehicleId: '', employeeId: '', mileageAtAssignment: 0 });
        this.toasts.success('Vehicle issued.');
        this.loadAll();
      },
      error: () => this.toasts.error('Vehicle issue failed.')
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
