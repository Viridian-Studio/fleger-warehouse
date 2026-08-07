import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

interface InventoryItem {
  _id: string;
  name: string;
  inventoryNumber: string;
  type: string;
  quantity: number;
  availableQuantity: number;
  unit?: string;
  status: string;
  location?: string;
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
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Inventory</h1>
          <p>{{ items().length }} items, {{ lowStockCount() }} low-stock records.</p>
        </div>
        <button class="primary-button" (click)="toggleCreate()"><span [appIcon]="showCreate() ? 'X' : 'Plus'"></span>{{ showCreate() ? 'Close' : 'Add item' }}</button>
      </div>

      <div class="metrics">
        <article class="data-card"><span appIcon="Boxes"></span><div><small>Total items</small><strong>{{ items().length }}</strong></div></article>
        <article class="data-card"><span appIcon="CircleCheck"></span><div><small>Available units</small><strong>{{ availableUnits() }}</strong></div></article>
        <article class="data-card"><span appIcon="ClipboardCheck"></span><div><small>Assigned units</small><strong>{{ assignedUnits() }}</strong></div></article>
      </div>

      @if (showCreate()) {
        <form class="toolbar-card form" [formGroup]="createForm" (ngSubmit)="create()">
          <label class="field"><span>Name</span><input formControlName="name" /></label>
          <div class="auto-number">
            <span appIcon="KeyRound"></span>
            <div>
              <strong>Auto number</strong>
              <small>Generated when the item is saved.</small>
            </div>
          </div>
          <label class="field"><span>Type</span><select formControlName="type"><option value="QUANTITY">Quantity</option><option value="ASSET">Asset</option></select></label>
          <label class="field"><span>Quantity</span><input type="number" min="1" formControlName="quantity" /></label>
          <label class="field"><span>Unit</span><input formControlName="unit" /></label>
          <label class="field"><span>Location</span><input formControlName="location" /></label>
          <button class="primary-button" type="submit" [disabled]="createForm.invalid"><span appIcon="Save"></span>Save item</button>
        </form>
      }

      <div class="table-shell">
        <div class="table-title"><h2>Stock list</h2><span class="status-pill">{{ items().length }} records</span></div>
        <div class="row head"><span>Name</span><span>Number</span><span>Type</span><span>Available</span><span>Status</span><span></span></div>
        @if (items().length === 0) {
          <div class="empty-state">No inventory items yet.</div>
        }
        @for (item of items(); track item._id) {
          <div class="row" [class.selected]="selected()?._id === item._id" (click)="select(item)">
            <span>{{ item.name }}</span>
            <span>{{ item.inventoryNumber }}</span>
            <span>{{ item.type }}</span>
            <span>{{ item.availableQuantity }} / {{ item.quantity }}</span>
            <span class="status-pill" [class.good]="item.status === 'AVAILABLE'" [class.warn]="item.availableQuantity === 0">{{ item.status }}</span>
            <button class="ghost-button" type="button" [disabled]="item.availableQuantity === 0" (click)="startAssign(item); $event.stopPropagation()"><span appIcon="Send"></span>Assign</button>
          </div>
        }
      </div>

      @if (selected()) {
        <aside class="preview data-card">
          <div class="title-row"><h2>{{ selected()?.name }}</h2><button class="ghost-button" (click)="selected.set(null)">Close</button></div>
          <dl>
            <dt>Inventory number</dt><dd>{{ selected()?.inventoryNumber }}</dd>
            <dt>Type</dt><dd>{{ selected()?.type }}</dd>
            <dt>Available</dt><dd>{{ selected()?.availableQuantity }} / {{ selected()?.quantity }}</dd>
            <dt>Status</dt><dd>{{ selected()?.status }}</dd>
            <dt>Location</dt><dd>{{ selected()?.location || '-' }}</dd>
          </dl>
          <form class="compact-form" [formGroup]="editForm" (ngSubmit)="update(selected()!._id)">
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field"><span>Type</span><select formControlName="type"><option value="QUANTITY">Quantity</option><option value="ASSET">Asset</option></select></label>
            <label class="field"><span>Unit</span><input formControlName="unit" /></label>
            <label class="field"><span>Location</span><input formControlName="location" /></label>
            <button class="primary-button" type="submit" [disabled]="editForm.invalid"><span appIcon="Save"></span>Update</button>
          </form>
          <div class="actions">
            <button class="danger-button" type="button" (click)="remove(selected()!._id)"><span appIcon="Trash2"></span>Delete</button>
          </div>
        </aside>
      }

      @if (assigning()) {
        <form class="toolbar-card assign-panel" [formGroup]="assignForm" (ngSubmit)="assign()">
          <div class="panel-head">
            <h2>Assign {{ assigning()?.name }}</h2>
            <button class="ghost-button" type="button" (click)="assigning.set(null)"><span appIcon="X"></span>Cancel</button>
          </div>
          <div class="form">
            <label class="field">
              <span>Issue to</span>
              <select formControlName="targetType"><option value="EMPLOYEE">Employee</option><option value="VEHICLE">Vehicle</option></select>
            </label>
            <label class="field">
              <span>Target</span>
              <select formControlName="targetId">
                <option value="">Select target</option>
                @if (assignForm.controls.targetType.value === 'EMPLOYEE') {
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
            <label class="field">
              <span>Quantity</span>
              <input type="number" min="1" formControlName="quantity" />
            </label>
            <button class="secondary-button" type="submit" [disabled]="assignForm.invalid"><span appIcon="Send"></span>Assign</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .metrics article { display: grid; grid-template-columns: 36px 1fr; gap: 10px; align-items: center; }
    .metrics article > span { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; color: var(--brand); background: var(--brand-soft); }
    .metrics small { color: var(--muted); display: block; }
    .metrics strong { font-size: 28px; }
    .form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; align-items: end; }
    .auto-number {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 10px;
      align-items: center;
      min-height: 64px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--brand-soft);
    }
    .auto-number > span {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      color: var(--brand);
      background: white;
    }
    .auto-number strong {
      display: block;
      font-size: 13px;
    }
    .auto-number small {
      color: var(--muted);
      line-height: 1.35;
    }
    .assign-panel { display: grid; gap: 14px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .row { display: grid; grid-template-columns: 1.4fr 1fr .8fr .8fr .8fr 90px; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; cursor: pointer; }
    .row:first-child { border-top: 0; }
    .row.selected { background: var(--brand-soft); }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; }
    dl { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; margin: 16px 0 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .compact-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; align-items: end; }
    .compact-form button { grid-column: span 2; }
    .actions { display: flex; gap: 10px; margin-top: 12px; }
    @media (max-width: 900px) { .metrics, .form, .row, .compact-form { grid-template-columns: 1fr; } .compact-form button { grid-column: auto; } }
  `
})
export class InventoryComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly items = signal<InventoryItem[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly selected = signal<InventoryItem | null>(null);
  readonly assigning = signal<InventoryItem | null>(null);
  readonly showCreate = signal(false);
  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['QUANTITY', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit: ['db'],
    location: ['']
  });
  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['QUANTITY', Validators.required],
    unit: ['db'],
    location: ['']
  });
  readonly assignForm = this.fb.nonNullable.group({
    targetType: ['EMPLOYEE', Validators.required],
    targetId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });

    this.assignForm.controls.targetType.valueChanges.subscribe(() => {
      this.assignForm.controls.targetId.setValue('');
    });
  }

  load() {
    this.api.get<InventoryItem[]>('/inventory/items').subscribe({
      next: (items) => this.items.set(items),
      error: () => undefined
    });
    this.api.get<Employee[]>('/employees').subscribe({ next: (employees) => this.employees.set(employees) });
    this.api.get<Vehicle[]>('/vehicles').subscribe({ next: (vehicles) => this.vehicles.set(vehicles) });
  }

  toggleCreate() {
    this.showCreate.update((value) => !value);
  }

  create() {
    if (this.createForm.invalid) return;
    this.api.post<InventoryItem>('/inventory/items', this.createForm.getRawValue()).subscribe({
      next: () => {
        this.createForm.reset({ name: '', type: 'QUANTITY', quantity: 1, unit: 'db', location: '' });
        this.showCreate.set(false);
        this.toasts.success('Inventory item saved.');
        this.load();
      },
      error: () => this.toasts.error('Could not save inventory item.')
    });
  }

  select(item: InventoryItem) {
    this.api.get<InventoryItem>(`/inventory/items/${item._id}`).subscribe({
      next: (fresh) => {
        this.selected.set(fresh);
        this.editForm.reset({
          name: fresh.name,
          type: fresh.type,
          unit: (fresh as InventoryItem & { unit?: string }).unit ?? 'db',
          location: fresh.location ?? ''
        });
      }
    });
  }

  update(id: string) {
    if (this.editForm.invalid) return;
    this.api.patch<InventoryItem>(`/inventory/items/${id}`, this.editForm.getRawValue()).subscribe({
      next: (item) => {
        this.selected.set(item);
        this.toasts.success('Inventory item updated.');
        this.load();
      },
      error: () => this.toasts.error('Could not update inventory item.')
    });
  }

  remove(id: string) {
    if (!window.confirm('Delete this inventory item?')) return;
    this.api.delete<InventoryItem>(`/inventory/items/${id}`).subscribe({
      next: () => {
        this.selected.set(null);
        this.assigning.set(null);
        this.toasts.success('Inventory item deleted.');
        this.load();
      },
      error: () => this.toasts.error('Could not delete inventory item.')
    });
  }

  startAssign(item: InventoryItem) {
    this.assigning.set(item);
    this.assignForm.patchValue({ quantity: 1, targetType: 'EMPLOYEE', targetId: '' });
  }

  assign() {
    const item = this.assigning();
    if (!item || this.assignForm.invalid) return;
    this.api.post('/assignments/inventory', { itemId: item._id, ...this.assignForm.getRawValue() }).subscribe({
      next: () => {
        this.assigning.set(null);
        this.toasts.success('Inventory assigned.');
        this.load();
      },
      error: () => this.toasts.error('Inventory assignment failed.')
    });
  }

  availableUnits() {
    return this.items().reduce((sum, item) => sum + item.availableQuantity, 0);
  }

  assignedUnits() {
    return this.items().reduce((sum, item) => sum + Math.max(item.quantity - item.availableQuantity, 0), 0);
  }

  lowStockCount() {
    return this.items().filter((item) => item.availableQuantity <= Math.max(1, Math.floor(item.quantity * 0.2))).length;
  }
}
