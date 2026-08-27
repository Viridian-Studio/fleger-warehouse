import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective, AppIconName } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { MetricCardComponent } from '../../shared/ui/feedback.component';
import { ToastService } from '../../shared/ui/toast.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AttentionPanelComponent } from './components/attention-panel.component';
import { QuickActionsComponent } from './components/quick-actions.component';
import { UtilizationCardComponent, BreakdownItem } from './components/utilization-card.component';
import { ActivityFeedComponent } from './components/activity-feed.component';
import { UpcomingEventsComponent } from './components/upcoming-events.component';
import { MovementChartComponent } from './components/movement-chart.component';
import {
  DashboardSummary,
  AttentionItem,
  UpcomingEvent,
  ActivityEntry,
  MovementBucket,
  LoadState
} from './dashboard.types';

interface InventoryItem { _id: string; name: string; inventoryNumber: string; type: string; availableQuantity: number; quantity: number; }
interface Employee { _id: string; firstName: string; lastName: string; employeeNumber: string; }
interface Vehicle { _id: string; licensePlate: string; manufacturer: string; model: string; currentMileage: number; status: string; }
interface InventoryCategory { _id: string; name: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IconDirective,
    TooltipDirective,
    MetricCardComponent,
    TranslatePipe,
    ReactiveFormsModule,
    ModalComponent,
    AttentionPanelComponent,
    QuickActionsComponent,
    UtilizationCardComponent,
    ActivityFeedComponent,
    UpcomingEventsComponent,
    MovementChartComponent
  ],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'dashboard.title' | translate }}</h1>
          <p>{{ 'dashboard.subtitle' | translate }}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="refreshing()" (click)="refreshAll()" appTooltip="{{ 'dashboard.refresh' | translate }}">
            @if (refreshing()) {
              <span class="spinner" aria-hidden="true"></span>
            } @else {
              <span appIcon="RefreshCw" [size]="16"></span>
            }
            {{ 'dashboard.refresh' | translate }}
          </button>
        </div>
      </div>

      <!-- Level 1: KPI cards -->
      <div class="metrics">
        @for (metric of metricCards(); track metric.labelKey) {
          <app-metric-card
            [icon]="metric.icon"
            [label]="metric.labelKey | translate"
            [value]="metric.value"
            [tone]="metric.tone"
            [hint]="metric.hint"
            [link]="metric.link"
            [loading]="summaryState() === 'loading'"
          />
        }
      </div>

      <!-- Level 1: Attention required -->
      @if (summaryState() === 'error') {
        <div class="state-card is-error summary-error">
          <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
          <h3>{{ 'dashboard.summaryError' | translate }}</h3>
          <p>{{ 'dashboard.summaryErrorDesc' | translate }}</p>
          <button class="btn btn--ghost" type="button" (click)="loadSummary()">
            <span appIcon="RefreshCw" [size]="16"></span>{{ 'dashboard.retry' | translate }}
          </button>
        </div>
      }

      <app-attention-panel
        [items]="attention()"
        [loading]="attentionState() === 'loading'"
        [error]="attentionState() === 'error'"
        (retry)="loadAttention()"
      />

      <!-- Level 2: Operational overview -->
      <div class="summary-grid">
        @if (summaryState() === 'loading') {
          <div class="card util-skeleton">
            <div class="card-head">
              <div class="head-title">
                <span class="skeleton skeleton--circle" style="width:32px;height:32px"></span>
                <div class="skel-title">
                  <span class="skeleton skeleton--text" style="width: 120px"></span>
                  <span class="skeleton skeleton--text" style="width: 180px"></span>
                </div>
              </div>
            </div>
            <div class="card-body">
              <span class="skeleton skeleton--line" style="width: 100%; height: 8px"></span>
              <div class="skel-legend">
                <span class="skeleton skeleton--text" style="width: 80px"></span>
                <span class="skeleton skeleton--text" style="width: 80px"></span>
              </div>
            </div>
          </div>
          <div class="card util-skeleton">
            <div class="card-head">
              <div class="head-title">
                <span class="skeleton skeleton--circle" style="width:32px;height:32px"></span>
                <div class="skel-title">
                  <span class="skeleton skeleton--text" style="width: 120px"></span>
                  <span class="skeleton skeleton--text" style="width: 180px"></span>
                </div>
              </div>
            </div>
            <div class="card-body">
              <span class="skeleton skeleton--line" style="width: 100%; height: 8px"></span>
              <div class="skel-legend">
                <span class="skeleton skeleton--text" style="width: 80px"></span>
                <span class="skeleton skeleton--text" style="width: 80px"></span>
              </div>
            </div>
          </div>
        } @else if (summaryState() === 'ready') {
          <app-utilization-card
            title="dashboard.warehouseReadiness"
            subtitleTpl="dashboard.warehouseReadinessText"
            icon="Boxes"
            [percent]="inventoryReadiness()"
            tone="brand"
            link="/inventory"
            [breakdown]="inventoryBreakdown()"
          />
          <app-utilization-card
            title="dashboard.fleetUtilization"
            subtitleTpl="dashboard.fleetUtilizationText"
            icon="Truck"
            [percent]="fleetUtilization()"
            tone="info"
            link="/vehicles"
            [breakdown]="fleetBreakdown()"
          />
        }
      </div>

      <!-- Level 3: Quick actions -->
      <app-quick-actions (actionClick)="onQuickAction($event)" />

      <!-- Level 3: Activity + Upcoming -->
      <div class="duo-grid">
        <app-activity-feed
          [entries]="activity()"
          [loading]="activityState() === 'loading'"
          [error]="activityState() === 'error'"
          (retry)="loadActivity()"
        />
        <app-upcoming-events
          [events]="upcoming()"
          [loading]="upcomingState() === 'loading'"
          [error]="upcomingState() === 'error'"
          (retry)="loadUpcoming()"
        />
      </div>

      <!-- Level 4: Optional analytics -->
      <app-movement-chart
        [buckets]="movement()"
        [loading]="movementState() === 'loading'"
        [error]="movementState() === 'error'"
        (retry)="loadMovement()"
        (frameChange)="loadMovement($event)"
      />
    </section>

    <!-- Quick action modals -->
    @if (showInventoryModal()) {
      <app-modal title="{{ 'dashboard.qaNewInventory' | translate }}" description="Új készlettétel létrehozása." size="lg" (close)="closeInventoryModal()">
        <form class="modal-form" [formGroup]="inventoryForm" (ngSubmit)="createInventory()">
          <div class="form-grid">
            <label class="field"><span class="field-label">Név <span class="req">*</span></span><input formControlName="name" /></label>
            <label class="field"><span class="field-label">Típus</span>
              <select formControlName="type"><option value="QUANTITY">Mennyiségi</option><option value="ASSET">Eszköz</option></select>
            </label>
            <label class="field"><span class="field-label">Mennyiség <span class="req">*</span></span><input type="number" min="1" formControlName="quantity" /></label>
            <label class="field"><span class="field-label">Egység</span><input formControlName="unit" /></label>
            <label class="field"><span class="field-label">Helyszín</span><input formControlName="location" /></label>
            <label class="field"><span class="field-label">Kategória</span>
              <select formControlName="categoryId">
                <option value="">Nincs kategória</option>
                @for (category of categories(); track category._id) {
                  <option [value]="category._id">{{ category.name }}</option>
                }
              </select>
            </label>
            <label class="field"><span class="field-label">Minimum készlet</span><input type="number" min="0" formControlName="lowStockThreshold" /></label>
            <label class="field"><span class="field-label">Sorozatszám</span><input formControlName="serialNumber" /></label>
          </div>
        </form>
        <div slot="footer" class="modal-foot">
          <button class="btn btn--ghost" type="button" (click)="closeInventoryModal()">{{ 'common.cancel' | translate }}</button>
          <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="inventoryForm.invalid || saving()" (click)="createInventory()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
            {{ 'common.save' | translate }}
          </button>
        </div>
      </app-modal>
    }

    @if (showEmployeeModal()) {
      <app-modal title="{{ 'dashboard.qaNewEmployee' | translate }}" description="Új dolgozó hozzáadása." size="md" (close)="closeEmployeeModal()">
        <form class="modal-form" [formGroup]="employeeForm" (ngSubmit)="createEmployee()">
          <div class="form-grid">
            <label class="field"><span class="field-label">Keresztnév <span class="req">*</span></span><input formControlName="firstName" /></label>
            <label class="field"><span class="field-label">Vezetéknév <span class="req">*</span></span><input formControlName="lastName" /></label>
            <label class="field"><span class="field-label">Email</span><input type="email" formControlName="email" /></label>
            <label class="field"><span class="field-label">Beosztás</span><input formControlName="position" /></label>
          </div>
        </form>
        <div slot="footer" class="modal-foot">
          <button class="btn btn--ghost" type="button" (click)="closeEmployeeModal()">{{ 'common.cancel' | translate }}</button>
          <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="employeeForm.invalid || saving()" (click)="createEmployee()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
            {{ 'common.save' | translate }}
          </button>
        </div>
      </app-modal>
    }

    @if (showVehicleModal()) {
      <app-modal title="{{ 'dashboard.qaNewVehicle' | translate }}" description="Új jármű regisztrálása." size="lg" (close)="closeVehicleModal()">
        <form class="modal-form" [formGroup]="vehicleForm" (ngSubmit)="createVehicle()">
          <div class="form-grid">
            <label class="field"><span class="field-label">Rendszám <small class="field-hint">auto, ha üres</small></span><input formControlName="licensePlate" /></label>
            <label class="field"><span class="field-label">Gyártmány <span class="req">*</span></span><input formControlName="manufacturer" /></label>
            <label class="field"><span class="field-label">Modell <span class="req">*</span></span><input formControlName="model" /></label>
            <label class="field"><span class="field-label">Évjárat</span><input type="number" formControlName="year" /></label>
            <label class="field"><span class="field-label">Üzemanyag</span>
              <select formControlName="fuelType">
                <option value="">—</option>
                <option value="petrol">Benzin</option>
                <option value="diesel">Dízel</option>
                <option value="electric">Elektromos</option>
                <option value="hybrid">Hibrid</option>
                <option value="lpg">LPG</option>
                <option value="other">Egyéb</option>
              </select>
            </label>
            <label class="field"><span class="field-label">Km óra állása</span><input type="number" formControlName="currentMileage" /></label>
            <label class="field"><span class="field-label">Műszaki vizsga lejárat</span><input type="date" formControlName="inspectionExpiry" /></label>
            <label class="field"><span class="field-label">Biztosítás lejárat</span><input type="date" formControlName="insuranceExpiry" /></label>
          </div>
        </form>
        <div slot="footer" class="modal-foot">
          <button class="btn btn--ghost" type="button" (click)="closeVehicleModal()">{{ 'common.cancel' | translate }}</button>
          <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="vehicleForm.invalid || saving()" (click)="createVehicle()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
            {{ 'common.save' | translate }}
          </button>
        </div>
      </app-modal>
    }

    @if (showAssignAssetModal()) {
      <app-modal title="{{ 'dashboard.qaIssueAsset' | translate }}" description="Eszköz kiadása dolgozónak vagy járműnek." size="sm" (close)="closeAssignAssetModal()">
        <form class="modal-form" [formGroup]="assignAssetForm" (ngSubmit)="assignAsset()">
          <label class="field"><span class="field-label">Eszköz</span>
            <select formControlName="itemId">
              <option value="">Válassz eszközt</option>
              @for (item of availableItems(); track item._id) {
                <option [value]="item._id">{{ item.name }} · {{ item.inventoryNumber }} · {{ item.availableQuantity }} / {{ item.quantity }}</option>
              }
            </select>
          </label>
          <label class="field"><span class="field-label">Kiadás</span>
            <select formControlName="targetType"><option value="EMPLOYEE">Dolgozónak</option><option value="VEHICLE">Járműnek</option></select>
          </label>
          <label class="field"><span class="field-label">Cél</span>
            <select formControlName="targetId">
              <option value="">Válassz célt</option>
              @if (assignAssetForm.controls.targetType.value === 'EMPLOYEE') {
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
          <label class="field"><span class="field-label">Mennyiség</span><input type="number" min="1" formControlName="quantity" /></label>
        </form>
        <div slot="footer" class="modal-foot">
          <button class="btn btn--ghost" type="button" (click)="closeAssignAssetModal()">{{ 'common.cancel' | translate }}</button>
          <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="assignAssetForm.invalid || saving()" (click)="assignAsset()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Send" [size]="16"></span> }
            {{ 'dashboard.qaIssueAsset' | translate }}
          </button>
        </div>
      </app-modal>
    }

    @if (showAssignVehicleModal()) {
      <app-modal title="{{ 'dashboard.qaAssignVehicle' | translate }}" description="Jármű hozzárendelése dolgozóhoz." size="sm" (close)="closeAssignVehicleModal()">
        <form class="modal-form" [formGroup]="assignVehicleForm" (ngSubmit)="assignVehicle()">
          <label class="field"><span class="field-label">Jármű</span>
            <select formControlName="vehicleId">
              <option value="">Válassz járművet</option>
              @for (vehicle of availableVehicles(); track vehicle._id) {
                <option [value]="vehicle._id">{{ vehicle.licensePlate }} · {{ vehicle.manufacturer }} {{ vehicle.model }} · {{ vehicle.currentMileage }} km</option>
              }
            </select>
          </label>
          <label class="field"><span class="field-label">Dolgozó</span>
            <select formControlName="employeeId">
              <option value="">Válassz dolgozót</option>
              @for (employee of employees(); track employee._id) {
                <option [value]="employee._id">{{ employee.lastName }} {{ employee.firstName }} · {{ employee.employeeNumber }}</option>
              }
            </select>
          </label>
          <label class="field"><span class="field-label">Km állás</span><input type="number" min="0" formControlName="mileageAtAssignment" /></label>
        </form>
        <div slot="footer" class="modal-foot">
          <button class="btn btn--ghost" type="button" (click)="closeAssignVehicleModal()">{{ 'common.cancel' | translate }}</button>
          <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="assignVehicleForm.invalid || saving()" (click)="assignVehicle()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="KeyRound" [size]="16"></span> }
            {{ 'dashboard.qaAssignVehicle' | translate }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [`
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .duo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .summary-error { max-width: 100%; }

    .util-skeleton .head-title { display: flex; align-items: center; gap: var(--space-3); }
    .skel-title { display: grid; gap: 6px; }
    .skel-legend { display: flex; gap: var(--space-4); margin-top: var(--space-4); }

    @media (max-width: 980px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) {
      .summary-grid, .duo-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  // --- State signals ---
  readonly refreshing = signal(false);
  readonly summaryState = signal<LoadState>('loading');
  readonly attentionState = signal<LoadState>('loading');
  readonly activityState = signal<LoadState>('loading');
  readonly upcomingState = signal<LoadState>('loading');
  readonly movementState = signal<LoadState>('loading');

  readonly summary = signal<DashboardSummary>({
    inventoryItems: 0,
    lowStock: 0,
    activeEmployees: 0,
    activeVehicles: 0,
    assignedVehicles: 0,
    assignedAssets: 0,
    availableVehicles: 0,
    serviceVehicles: 0,
    availableUnits: 0
  });
  readonly attention = signal<AttentionItem[]>([]);
  readonly activity = signal<ActivityEntry[]>([]);
  readonly upcoming = signal<UpcomingEvent[]>([]);
  readonly movement = signal<MovementBucket[]>([]);

  // --- Quick action modal state ---
  readonly saving = signal(false);
  readonly showInventoryModal = signal(false);
  readonly showEmployeeModal = signal(false);
  readonly showVehicleModal = signal(false);
  readonly showAssignAssetModal = signal(false);
  readonly showAssignVehicleModal = signal(false);

  // Reference data for modals
  readonly categories = signal<InventoryCategory[]>([]);
  readonly items = signal<InventoryItem[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly vehicles = signal<Vehicle[]>([]);

  // --- Forms ---
  readonly inventoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['QUANTITY', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit: ['db'],
    location: [''],
    categoryId: [''],
    lowStockThreshold: [5],
    serialNumber: ['']
  });

  readonly employeeForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: [''],
    position: ['']
  });

  readonly vehicleForm = this.fb.nonNullable.group({
    licensePlate: [''],
    manufacturer: ['', Validators.required],
    model: ['', Validators.required],
    year: [undefined as number | undefined],
    fuelType: [''],
    currentMileage: [0],
    inspectionExpiry: [''],
    insuranceExpiry: ['']
  });

  readonly assignAssetForm = this.fb.nonNullable.group({
    itemId: ['', Validators.required],
    targetType: ['EMPLOYEE', Validators.required],
    targetId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  readonly assignVehicleForm = this.fb.nonNullable.group({
    vehicleId: ['', Validators.required],
    employeeId: ['', Validators.required],
    mileageAtAssignment: [0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.loadAll());
    });

    this.assignAssetForm.controls.targetType.valueChanges.subscribe(() => {
      this.assignAssetForm.controls.targetId.setValue('');
    });

    this.assignVehicleForm.controls.vehicleId.valueChanges.subscribe((vehicleId) => {
      const vehicle = this.vehicles().find((v) => v._id === vehicleId);
      if (vehicle) this.assignVehicleForm.controls.mileageAtAssignment.setValue(vehicle.currentMileage);
    });
  }

  // --- KPI cards ---
  metricCards() {
    const data = this.summary();
    return [
      {
        labelKey: 'dashboard.inventoryItems',
        value: data.inventoryItems,
        tone: 'neutral' as const,
        icon: 'Package' as AppIconName,
        hint: `${data.inventoryItems} tracked`,
        link: '/inventory'
      },
      {
        labelKey: 'dashboard.lowStock',
        value: data.lowStock,
        tone: (data.lowStock > 0 ? 'warn' : 'success') as 'warn' | 'success',
        icon: 'TriangleAlert' as AppIconName,
        hint: data.lowStock > 0 ? 'Needs attention' : 'Healthy',
        link: '/inventory?filter=low-stock'
      },
      {
        labelKey: 'dashboard.assignedAssets',
        value: data.assignedAssets,
        tone: 'info' as const,
        icon: 'ClipboardCheck' as AppIconName,
        hint: 'Currently issued',
        link: '/assignments'
      },
      {
        labelKey: 'dashboard.activeEmployees',
        value: data.activeEmployees,
        tone: 'neutral' as const,
        icon: 'Users' as AppIconName,
        hint: 'In workforce',
        link: '/employees'
      },
      {
        labelKey: 'dashboard.activeVehicles',
        value: data.activeVehicles,
        tone: 'neutral' as const,
        icon: 'Truck' as AppIconName,
        hint: 'In fleet',
        link: '/vehicles'
      },
      {
        labelKey: 'dashboard.assignedVehicles',
        value: data.assignedVehicles,
        tone: 'info' as const,
        icon: 'KeyRound' as AppIconName,
        hint: 'On the road',
        link: '/vehicles'
      }
    ];
  }

  // --- Utilization calculations ---
  inventoryReadiness(): number {
    const data = this.summary();
    if (data.inventoryItems === 0) return 100;
    return Math.max(0, Math.min(100, Math.round(((data.inventoryItems - data.lowStock) / data.inventoryItems) * 100)));
  }

  fleetUtilization(): number {
    const data = this.summary();
    if (data.activeVehicles === 0) return 0;
    return Math.max(0, Math.min(100, Math.round((data.assignedVehicles / data.activeVehicles) * 100)));
  }

  inventoryBreakdown(): BreakdownItem[] {
    const data = this.summary();
    return [
      { label: this.t('dashboard.available'), value: data.availableUnits, tone: 'brand' },
      { label: this.t('dashboard.assigned'), value: data.assignedAssets, tone: 'info' },
      { label: this.t('dashboard.lowStockLabel'), value: data.lowStock, tone: 'warn' }
    ];
  }

  fleetBreakdown(): BreakdownItem[] {
    const data = this.summary();
    return [
      { label: this.t('dashboard.assignedVehicles'), value: data.assignedVehicles, tone: 'info' },
      { label: this.t('dashboard.availableVehicles'), value: data.availableVehicles, tone: 'brand' },
      { label: this.t('dashboard.serviceVehicles'), value: data.serviceVehicles, tone: 'warn' }
    ];
  }

  private t(key: string): string {
    return this.i18n.t(key);
  }

  // --- Data loading ---
  loadAll() {
    this.loadSummary();
    this.loadAttention();
    this.loadActivity();
    this.loadUpcoming();
    this.loadMovement();
  }

  refreshAll() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.loadAll();
    // The refresh button re-enables once all sections have settled (not loading).
    // We poll the states briefly; each section sets its own state independently.
    const check = window.setInterval(() => {
      const allSettled =
        this.summaryState() !== 'loading' &&
        this.attentionState() !== 'loading' &&
        this.activityState() !== 'loading' &&
        this.upcomingState() !== 'loading' &&
        this.movementState() !== 'loading';
      if (allSettled) {
        window.clearInterval(check);
        this.refreshing.set(false);
        const anyError =
          this.summaryState() === 'error' ||
          this.attentionState() === 'error' ||
          this.activityState() === 'error' ||
          this.upcomingState() === 'error' ||
          this.movementState() === 'error';
        if (anyError) {
          this.toasts.error(this.t('dashboard.refreshFailed'));
        } else {
          this.toasts.success(this.t('dashboard.refreshed'));
        }
      }
    }, 120);
  }

  loadSummary() {
    this.summaryState.set('loading');
    this.api.get<DashboardSummary>('/dashboard').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryState.set('ready');
      },
      error: () => this.summaryState.set('error')
    });
  }

  loadAttention() {
    this.attentionState.set('loading');
    this.api.get<AttentionItem[]>('/dashboard/attention').subscribe({
      next: (items) => {
        this.attention.set(items);
        this.attentionState.set('ready');
      },
      error: () => this.attentionState.set('error')
    });
  }

  loadActivity() {
    this.activityState.set('loading');
    this.api.get<ActivityEntry[]>('/dashboard/activity?limit=8').subscribe({
      next: (entries) => {
        this.activity.set(entries);
        this.activityState.set('ready');
      },
      error: () => this.activityState.set('error')
    });
  }

  loadUpcoming() {
    this.upcomingState.set('loading');
    this.api.get<UpcomingEvent[]>('/dashboard/upcoming').subscribe({
      next: (events) => {
        this.upcoming.set(events);
        this.upcomingState.set('ready');
      },
      error: () => this.upcomingState.set('error')
    });
  }

  loadMovement(days = 30) {
    this.movementState.set('loading');
    this.api.get<MovementBucket[]>(`/dashboard/movement?days=${days}`).subscribe({
      next: (buckets) => {
        this.movement.set(buckets);
        this.movementState.set('ready');
      },
      error: () => this.movementState.set('error')
    });
  }

  // --- Quick actions ---
  onQuickAction(actionId: string) {
    switch (actionId) {
      case 'new-inventory':
        this.ensureReferenceData();
        this.showInventoryModal.set(true);
        break;
      case 'new-employee':
        this.ensureReferenceData();
        this.showEmployeeModal.set(true);
        break;
      case 'new-vehicle':
        this.showVehicleModal.set(true);
        break;
      case 'issue-asset':
        this.ensureReferenceData();
        this.showAssignAssetModal.set(true);
        break;
      case 'assign-vehicle':
        this.ensureReferenceData();
        this.showAssignVehicleModal.set(true);
        break;
      default:
        break;
    }
  }

  private ensureReferenceData() {
    if (this.items().length === 0) {
      this.api.get<InventoryItem[]>('/inventory/items').subscribe({ next: (items) => this.items.set(items) });
    }
    if (this.employees().length === 0) {
      this.api.get<Employee[]>('/employees').subscribe({ next: (employees) => this.employees.set(employees) });
    }
    if (this.vehicles().length === 0) {
      this.api.get<Vehicle[]>('/vehicles').subscribe({ next: (vehicles) => this.vehicles.set(vehicles) });
    }
    if (this.categories().length === 0) {
      this.api.get<InventoryCategory[]>('/inventory-categories').subscribe({ next: (categories) => this.categories.set(categories) });
    }
  }

  availableItems(): InventoryItem[] {
    return this.items().filter((i) => i.availableQuantity > 0);
  }

  availableVehicles(): Vehicle[] {
    return this.vehicles().filter((v) => v.status === 'AVAILABLE');
  }

  // --- Modal close handlers ---
  closeInventoryModal() { this.showInventoryModal.set(false); }
  closeEmployeeModal() { this.showEmployeeModal.set(false); }
  closeVehicleModal() { this.showVehicleModal.set(false); }
  closeAssignAssetModal() { this.showAssignAssetModal.set(false); }
  closeAssignVehicleModal() { this.showAssignVehicleModal.set(false); }

  // --- Create / assign handlers ---
  createInventory() {
    if (this.inventoryForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post('/inventory/items', this.inventoryForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showInventoryModal.set(false);
        this.inventoryForm.reset({ name: '', type: 'QUANTITY', quantity: 1, unit: 'db', location: '', categoryId: '', lowStockThreshold: 5, serialNumber: '' });
        this.toasts.success('Készlettétel létrehozva.');
        this.loadSummary();
        this.loadAttention();
        this.loadActivity();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült létrehozni a készlettételt.');
      }
    });
  }

  createEmployee() {
    if (this.employeeForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post('/employees', this.employeeForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEmployeeModal.set(false);
        this.employeeForm.reset({ firstName: '', lastName: '', email: '', position: '' });
        this.toasts.success('Dolgozó létrehozva.');
        this.loadSummary();
        this.loadActivity();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült létrehozni a dolgozót.');
      }
    });
  }

  createVehicle() {
    if (this.vehicleForm.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.vehicleForm.getRawValue();
    const payload = {
      ...raw,
      year: raw.year ?? undefined,
      currentMileage: raw.currentMileage ?? 0,
      inspectionExpiry: raw.inspectionExpiry || undefined,
      insuranceExpiry: raw.insuranceExpiry || undefined
    };
    this.api.post('/vehicles', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showVehicleModal.set(false);
        this.vehicleForm.reset({ licensePlate: '', manufacturer: '', model: '', year: undefined, fuelType: '', currentMileage: 0, inspectionExpiry: '', insuranceExpiry: '' });
        this.toasts.success('Jármű létrehozva.');
        this.loadSummary();
        this.loadAttention();
        this.loadUpcoming();
        this.loadActivity();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült létrehozni a járművet.');
      }
    });
  }

  assignAsset() {
    if (this.assignAssetForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post('/assignments/inventory', this.assignAssetForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAssignAssetModal.set(false);
        this.assignAssetForm.reset({ itemId: '', targetType: 'EMPLOYEE', targetId: '', quantity: 1 });
        this.toasts.success('Eszköz kiadva.');
        this.loadSummary();
        this.loadActivity();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült kiadni az eszközt.');
      }
    });
  }

  assignVehicle() {
    if (this.assignVehicleForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post('/assignments/vehicles', this.assignVehicleForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAssignVehicleModal.set(false);
        this.assignVehicleForm.reset({ vehicleId: '', employeeId: '', mileageAtAssignment: 0 });
        this.toasts.success('Jármű hozzárendelve.');
        this.loadSummary();
        this.loadActivity();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült hozzárendelni a járművet.');
      }
    });
  }
}
