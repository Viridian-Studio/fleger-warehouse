import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

interface Vehicle {
  _id: string;
  licensePlate: string;
  manufacturer: string;
  model: string;
  currentMileage: number;
  status: string;
  active: boolean;
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [IconDirective, ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="title-row">
        <div class="page-title">
          <h1>Vehicles</h1>
          <p>{{ readyCount() }} ready, {{ assignedCount() }} assigned, {{ serviceCount() }} in service.</p>
        </div>
        <button class="secondary-button" (click)="showCreate.update(toggle)"><span [appIcon]="showCreate() ? 'X' : 'Plus'"></span>{{ showCreate() ? 'Close' : 'Add vehicle' }}</button>
      </div>

      @if (showCreate()) {
        <form class="toolbar-card form" [formGroup]="form" (ngSubmit)="create()">
          <label class="field"><span>Plate</span><input formControlName="licensePlate" /></label>
          <label class="field"><span>Manufacturer</span><input formControlName="manufacturer" /></label>
          <label class="field"><span>Model</span><input formControlName="model" /></label>
          <label class="field"><span>Year</span><input type="number" formControlName="year" /></label>
          <label class="field"><span>VIN</span><input formControlName="vin" /></label>
          <label class="field"><span>Mileage</span><input type="number" formControlName="currentMileage" /></label>
          <button class="secondary-button" type="submit" [disabled]="form.invalid"><span appIcon="Save"></span>Save vehicle</button>
        </form>
      }

      <div class="table-shell">
        <div class="table-title"><h2>Vehicle list</h2><span class="status-pill">{{ vehicles().length }} records</span></div>
        <div class="row head"><span>Plate</span><span>Vehicle</span><span>Mileage</span><span>Status</span><span>Active</span></div>
        @if (vehicles().length === 0) {
          <div class="empty-state">No vehicles yet.</div>
        }
        @for (vehicle of vehicles(); track vehicle._id) {
          <div class="row" [class.selected]="selected()?._id === vehicle._id" (click)="select(vehicle)">
            <strong>{{ vehicle.licensePlate }}</strong>
            <span>{{ vehicle.manufacturer }} {{ vehicle.model }}</span>
            <span>{{ vehicle.currentMileage }} km</span>
            <span class="status-pill" [class.good]="vehicle.status === 'AVAILABLE'" [class.info]="vehicle.status === 'ASSIGNED'" [class.warn]="vehicle.status === 'SERVICE'">{{ vehicle.status }}</span>
            <span>{{ vehicle.active ? 'Yes' : 'No' }}</span>
          </div>
        }
      </div>

      @if (selected()) {
        <aside class="preview data-card">
          <div class="title-row"><h2>{{ selected()?.licensePlate }}</h2><button class="ghost-button" (click)="selected.set(null)">Close</button></div>
          <dl>
            <dt>Vehicle</dt><dd>{{ selected()?.manufacturer }} {{ selected()?.model }}</dd>
            <dt>Mileage</dt><dd>{{ selected()?.currentMileage }} km</dd>
            <dt>Status</dt><dd>{{ selected()?.status }}</dd>
            <dt>Active</dt><dd>{{ selected()?.active ? 'Yes' : 'No' }}</dd>
          </dl>
          <form class="compact-form" [formGroup]="updateForm" (ngSubmit)="update(selected()!._id)">
            <label class="field"><span>Mileage</span><input type="number" formControlName="currentMileage" /></label>
            <label class="field"><span>Status</span><select formControlName="status">
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="SERVICE">Service</option>
              <option value="INACTIVE">Inactive</option>
            </select></label>
            <button class="secondary-button" type="submit"><span appIcon="Save"></span>Update</button>
          </form>
          <div class="actions">
            <button class="danger-button" type="button" (click)="remove(selected()!._id)"><span appIcon="Trash2"></span>Delete</button>
          </div>
        </aside>
      }
    </section>
  `,
  styles: `
    h1, h2 { margin: 0; font-size: 28px; }
    h2 { font-size: 20px; }
    .form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; align-items: end; }
    .row { display: grid; grid-template-columns: .8fr 1.4fr .8fr .8fr .5fr; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--line); align-items: center; cursor: pointer; }
    .row:first-child { border-top: 0; }
    .row.selected { background: var(--brand-2-soft); }
    .head { color: var(--muted); background: #f4f6fa; font-size: 13px; font-weight: 700; cursor: default; }
    span { color: var(--muted); }
    dl { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; margin: 16px 0 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .compact-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; margin-top: 18px; align-items: end; }
    .actions { display: flex; gap: 10px; margin-top: 12px; }
    @media (max-width: 1000px) { .form, .compact-form, .row { grid-template-columns: 1fr; } }
  `
})
export class VehiclesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly selected = signal<Vehicle | null>(null);
  readonly showCreate = signal(false);
  readonly toggle = (value: boolean) => !value;
  readonly form = this.fb.nonNullable.group({
    licensePlate: ['', Validators.required],
    manufacturer: ['', Validators.required],
    model: ['', Validators.required],
    year: [2026],
    vin: [''],
    currentMileage: [0]
  });
  readonly updateForm = this.fb.nonNullable.group({
    currentMileage: [0],
    status: ['AVAILABLE']
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  load() {
    this.api.get<Vehicle[]>('/vehicles').subscribe({
      next: (vehicles) => this.vehicles.set(vehicles),
      error: () => undefined
    });
  }

  create() {
    if (this.form.invalid) return;
    this.api.post<Vehicle>('/vehicles', this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ licensePlate: '', manufacturer: '', model: '', year: 2026, vin: '', currentMileage: 0 });
        this.showCreate.set(false);
        this.toasts.success('Vehicle saved.');
        this.load();
      },
      error: () => this.toasts.error('Could not save vehicle.')
    });
  }

  select(vehicle: Vehicle) {
    this.api.get<Vehicle>(`/vehicles/${vehicle._id}`).subscribe({
      next: (fresh) => {
        this.selected.set(fresh);
        this.updateForm.patchValue({ currentMileage: fresh.currentMileage, status: fresh.status });
      }
    });
  }

  update(id: string) {
    this.api.patch<Vehicle>(`/vehicles/${id}`, this.updateForm.getRawValue()).subscribe({
      next: (vehicle) => {
        this.selected.set(vehicle);
        this.toasts.success('Vehicle updated.');
        this.load();
      },
      error: () => this.toasts.error('Could not update vehicle.')
    });
  }

  remove(id: string) {
    if (!window.confirm('Delete this vehicle?')) return;
    this.api.delete<Vehicle>(`/vehicles/${id}`).subscribe({
      next: () => {
        this.selected.set(null);
        this.toasts.success('Vehicle deleted.');
        this.load();
      },
      error: () => this.toasts.error('Could not delete vehicle.')
    });
  }

  readyCount() {
    return this.vehicles().filter((vehicle) => vehicle.status === 'AVAILABLE').length;
  }

  assignedCount() {
    return this.vehicles().filter((vehicle) => vehicle.status === 'ASSIGNED').length;
  }

  serviceCount() {
    return this.vehicles().filter((vehicle) => vehicle.status === 'SERVICE').length;
  }
}
