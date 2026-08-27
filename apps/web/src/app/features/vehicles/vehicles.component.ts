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

interface Vehicle {
  _id: string;
  licensePlate: string;
  manufacturer: string;
  model: string;
  year?: number;
  vin?: string;
  currentMileage: number;
  status: string;
  active: boolean;
}

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Vehicles</h1>
          <p>{{ readyCount() }} ready · {{ assignedCount() }} assigned · {{ serviceCount() }} in service</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--secondary" type="button" (click)="openCreate()">
            <span appIcon="Plus" [size]="16"></span>Add vehicle
          </button>
        </div>
      </div>

      <div class="metrics">
        <article class="mini-metric">
          <span class="mini-icon good" appIcon="CircleCheck" [size]="18"></span>
          <div><small>Ready</small><strong>{{ readyCount() }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon info" appIcon="KeyRound" [size]="18"></span>
          <div><small>Assigned</small><strong>{{ assignedCount() }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon warn" appIcon="Wrench" [size]="18"></span>
          <div><small>In service</small><strong>{{ serviceCount() }}</strong></div>
        </article>
      </div>

      <div class="table-shell">
        <div class="table-title">
          <h2>Vehicle list</h2>
          <span class="table-meta">{{ vehicles().length }} records</span>
        </div>
        <div class="table-scroll">
          @if (state() === 'loading') {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 28%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                  <span class="skeleton skeleton--line" style="width: 12%"></span>
                </div>
              }
            </div>
          } @else if (state() === 'error') {
            <div class="state-card is-error">
              <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
              <h3>Couldn't load vehicles</h3>
              <p>Something went wrong while fetching the fleet. Please try again.</p>
              <button class="btn btn--ghost" type="button" (click)="load()"><span appIcon="RefreshCw" [size]="16"></span>Try again</button>
            </div>
          } @else if (vehicles().length === 0) {
            <app-empty-state icon="Truck" title="No vehicles yet" description="Add your first vehicle to start managing your fleet.">
              <button class="btn btn--secondary" type="button" (click)="openCreate()"><span appIcon="Plus" [size]="16"></span>Add vehicle</button>
            </app-empty-state>
          } @else {
            <div class="row head">
              <span>Plate</span><span>Vehicle</span><span>Mileage</span><span>Status</span><span>Active</span><span></span>
            </div>
            @for (vehicle of vehicles(); track vehicle._id) {
              <div class="row" (click)="select(vehicle)">
                <strong class="mono">{{ vehicle.licensePlate }}</strong>
                <span class="truncate">{{ vehicle.manufacturer }} {{ vehicle.model }}</span>
                <span class="col-muted">{{ vehicle.currentMileage.toLocaleString() }} km</span>
                <span class="badge" [class.badge--good]="vehicle.status === 'AVAILABLE'" [class.badge--info]="vehicle.status === 'ASSIGNED'" [class.badge--warn]="vehicle.status === 'SERVICE'">{{ vehicle.status }}</span>
                <span class="badge" [class.badge--good]="vehicle.active" [class.badge--muted]="!vehicle.active">{{ vehicle.active ? 'Yes' : 'No' }}</span>
                <span class="row-actions" (click)="$event.stopPropagation()">
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="openEdit(vehicle)">
                    <span appIcon="Pencil" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      @if (showCreate()) {
        <app-modal title="Add vehicle" description="Register a new vehicle in the fleet." size="md" (close)="closeCreate()">
          <form class="modal-form" [formGroup]="form" (ngSubmit)="create()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Plate <small class="field-hint">auto-generated if empty</small></span><input formControlName="licensePlate" placeholder="e.g. ACM-VEH-0001" /></label>
              <label class="field"><span class="field-label">Manufacturer <span class="req">*</span></span><input formControlName="manufacturer" /></label>
              <label class="field"><span class="field-label">Model <span class="req">*</span></span><input formControlName="model" /></label>
              <label class="field"><span class="field-label">Year</span><input type="number" formControlName="year" /></label>
              <label class="field"><span class="field-label">VIN</span><input formControlName="vin" /></label>
              <label class="field"><span class="field-label">Mileage</span><input type="number" formControlName="currentMileage" /></label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Cancel</button>
            <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || saving()" (click)="create()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Save vehicle
            </button>
          </div>
        </app-modal>
      }

      @if (showEdit() && selected(); as v) {
        <app-modal [title]="v.licensePlate" [description]="v.manufacturer + ' ' + v.model" size="sm" (close)="closeEdit()">
          <dl class="detail-dl">
            <dt>Vehicle</dt><dd>{{ v.manufacturer }} {{ v.model }}</dd>
            <dt>Mileage</dt><dd>{{ v.currentMileage.toLocaleString() }} km</dd>
            <dt>Status</dt><dd><span class="badge" [class.badge--good]="v.status === 'AVAILABLE'">{{ v.status }}</span></dd>
            <dt>Active</dt><dd>{{ v.active ? 'Yes' : 'No' }}</dd>
          </dl>
          <form class="modal-form" [formGroup]="updateForm" (ngSubmit)="update(v._id)">
            <label class="field"><span class="field-label">Mileage</span><input type="number" formControlName="currentMileage" /></label>
            <label class="field"><span class="field-label">Status</span>
              <select formControlName="status">
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="SERVICE">Service</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </form>
          <div slot="footer" class="modal-foot modal-foot--between">
            <div class="cluster">
              <button class="btn btn--danger" type="button" [class.btn--loading]="deleting()" (click)="remove(v._id)">
                @if (deleting()) { <span class="spinner"></span> } @else { <span appIcon="Trash2" [size]="16"></span> }
                Delete
              </button>
              <button class="btn btn--ghost" type="button" (click)="printVehicle(v)">
                <span appIcon="Printer" [size]="16"></span>
                Print label
              </button>
            </div>
            <div class="cluster">
              <button class="btn btn--ghost" type="button" (click)="closeEdit()">Cancel</button>
              <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="updateForm.invalid || saving()" (click)="update(v._id)">
                @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
                Update
              </button>
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
    .mini-icon.info { background: var(--info-soft); color: var(--info); }
    .mini-icon.warn { background: var(--warn-soft); color: var(--warn); }
    .mini-metric small { color: var(--muted); display: block; font-size: 13px; }
    .mini-metric strong { font-size: 22px; font-weight: 700; color: var(--ink-strong); }

    .row { display: grid; grid-template-columns: .8fr 1.4fr .8fr .8fr .5fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row:not(.head) { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .row:not(.head):hover { background: var(--surface-hover); }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .detail-dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-4); }
    .detail-dl dt { color: var(--muted); font-size: 13px; font-weight: 600; }
    .detail-dl dd { margin: 0; font-size: 14px; }

    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr; }
      .form-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3), .row span:nth-child(5) { display: none; }
      .row.head { display: none; }
    }
  `]
})
export class VehiclesComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly selected = signal<Vehicle | null>(null);
  readonly showCreate = signal(false);
  readonly showEdit = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly form = this.fb.nonNullable.group({
    licensePlate: [''],
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
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.state.set('loading');
    this.api.get<Vehicle[]>('/vehicles').subscribe({
      next: (vehicles) => {
        this.vehicles.set(vehicles);
        this.loading.set(false);
        this.state.set('ready');
      },
      error: () => {
        this.loading.set(false);
        this.state.set('error');
      }
    });
  }

  openCreate() {
    this.form.reset({ licensePlate: '', manufacturer: '', model: '', year: 2026, vin: '', currentMileage: 0 });
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  create() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post<Vehicle>('/vehicles', this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.toasts.success('Vehicle saved.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not save vehicle.');
      }
    });
  }

  printVehicle(v: Vehicle) {
    printLabel({
      number: v.licensePlate,
      title: 'Vehicle',
      subtitle: `${v.manufacturer} ${v.model}`,
      meta: [
        { label: 'Year', value: v.year ? String(v.year) : '-' },
        { label: 'VIN', value: v.vin ?? '-' }
      ]
    });
  }

  select(vehicle: Vehicle) {
    this.openEdit(vehicle);
  }

  openEdit(vehicle: Vehicle) {
    this.api.get<Vehicle>(`/vehicles/${vehicle._id}`).subscribe({
      next: (fresh) => {
        this.selected.set(fresh);
        this.updateForm.patchValue({ currentMileage: fresh.currentMileage, status: fresh.status });
        this.showEdit.set(true);
      }
    });
  }

  closeEdit() {
    this.showEdit.set(false);
    this.selected.set(null);
  }

  update(id: string) {
    if (this.updateForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.patch<Vehicle>(`/vehicles/${id}`, this.updateForm.getRawValue()).subscribe({
      next: (vehicle) => {
        this.saving.set(false);
        this.selected.set(vehicle);
        this.toasts.success('Vehicle updated.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not update vehicle.');
      }
    });
  }

  async remove(id: string) {
    const ok = await this.confirm.confirm({
      title: 'Delete vehicle?',
      message: 'This will permanently remove the vehicle and its assignment history. This action cannot be undone.',
      confirmLabel: 'Delete vehicle',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.deleting.set(true);
    this.confirm.setLoading(true);
    this.api.delete<Vehicle>(`/vehicles/${id}`).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.closeEdit();
        this.toasts.success('Vehicle deleted.');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.toasts.error('Could not delete vehicle.');
      }
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
