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
  color?: string;
  fuelType?: string;
  registrationDate?: string;
  currentMileage: number;
  status: string;
  active: boolean;
  nextServiceMileage?: number;
  inspectionExpiry?: string;
  insuranceExpiry?: string;
  insurancePolicyNumber?: string;
  notes?: string;
}

interface MaintenanceLog {
  _id: string;
  vehicleId: string;
  date: string;
  mileageAtService: number;
  cost?: number;
  type: string;
  notes?: string;
}

type DateStatus = 'ok' | 'warning' | 'expired' | 'none';
type LoadState = 'loading' | 'ready' | 'error';

const MAINTENANCE_TYPES: { value: string; label: string }[] = [
  { value: 'oil', label: 'Olajcsere' },
  { value: 'tire', label: 'Gumicsere' },
  { value: 'inspection', label: 'Műszaki vizsga' },
  { value: 'repair', label: 'Javítás' },
  { value: 'other', label: 'Egyéb' }
];

const FUEL_TYPES: { value: string; label: string }[] = [
  { value: 'petrol', label: 'Benzin' },
  { value: 'diesel', label: 'Dízel' },
  { value: 'electric', label: 'Elektromos' },
  { value: 'hybrid', label: 'Hibrid' },
  { value: 'lpg', label: 'LPG' },
  { value: 'other', label: 'Egyéb' }
];

function toDateStr(value?: string | Date): string | undefined {
  if (!value) return undefined;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function formatDate(value?: string | Date): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function dateStatus(value?: string | Date, warningDays = 30): DateStatus {
  if (!value) return 'none';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return 'none';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + warningDays);
  if (d < now) return 'expired';
  if (d <= threshold) return 'warning';
  return 'ok';
}

function daysUntil(value?: string | Date): number | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Járművek</h1>
          <p>{{ readyCount() }} elérhető · {{ assignedCount() }} kiosztva · {{ serviceCount() }} szervizben</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Frissítés">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Frissítés
          </button>
          <button class="btn btn--secondary" type="button" (click)="openCreate()">
            <span appIcon="Plus" [size]="16"></span>Jármű hozzáadása
          </button>
        </div>
      </div>

      <div class="metrics">
        <article class="mini-metric">
          <span class="mini-icon good" appIcon="CircleCheck" [size]="18"></span>
          <div><small>Elérhető</small><strong>{{ readyCount() }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon info" appIcon="KeyRound" [size]="18"></span>
          <div><small>Kiosztva</small><strong>{{ assignedCount() }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon warn" appIcon="Wrench" [size]="18"></span>
          <div><small>Szervizben</small><strong>{{ serviceCount() }}</strong></div>
        </article>
      </div>

      <div class="table-shell">
        <div class="table-title">
          <h2>Jármű lista</h2>
          <span class="table-meta">{{ vehicles().length }} db</span>
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
              <h3>Nem sikerült betölteni</h3>
              <p>Valami hiba történt a járművek lekérésekor. Próbáld újra.</p>
              <button class="btn btn--ghost" type="button" (click)="load()"><span appIcon="RefreshCw" [size]="16"></span>Újra</button>
            </div>
          } @else if (vehicles().length === 0) {
            <app-empty-state icon="Truck" title="Még nincs jármű" description="Add hozzá az első járművet a flotta kezelésének megkezdéséhez.">
              <button class="btn btn--secondary" type="button" (click)="openCreate()"><span appIcon="Plus" [size]="16"></span>Jármű hozzáadása</button>
            </app-empty-state>
          } @else {
            <div class="row head">
              <span>Rendszám</span><span>Jármű</span><span>Km</span><span>Állapot</span><span>Műszaki</span><span>Biztosítás</span><span></span>
            </div>
            @for (vehicle of vehicles(); track vehicle._id) {
              <div class="row" (click)="select(vehicle)">
                <strong class="mono">{{ vehicle.licensePlate }}</strong>
                <span class="truncate">{{ vehicle.manufacturer }} {{ vehicle.model }}</span>
                <span class="col-muted">{{ vehicle.currentMileage.toLocaleString() }} km</span>
                <span class="badge" [class.badge--good]="vehicle.status === 'AVAILABLE'" [class.badge--info]="vehicle.status === 'ASSIGNED'" [class.badge--warn]="vehicle.status === 'SERVICE'">{{ statusLabel(vehicle.status) }}</span>
                <span class="date-cell" [class.date--ok]="dateStatus(vehicle.inspectionExpiry) === 'ok'" [class.date--warn]="dateStatus(vehicle.inspectionExpiry) === 'warning'" [class.date--expired]="dateStatus(vehicle.inspectionExpiry) === 'expired'" [class.date--none]="dateStatus(vehicle.inspectionExpiry) === 'none'">
                  {{ formatDate(vehicle.inspectionExpiry) }}
                  @if (daysUntil(vehicle.inspectionExpiry) !== null) {
                    <small>{{ daysLabel(vehicle.inspectionExpiry) }}</small>
                  }
                </span>
                <span class="date-cell" [class.date--ok]="dateStatus(vehicle.insuranceExpiry) === 'ok'" [class.date--warn]="dateStatus(vehicle.insuranceExpiry) === 'warning'" [class.date--expired]="dateStatus(vehicle.insuranceExpiry) === 'expired'" [class.date--none]="dateStatus(vehicle.insuranceExpiry) === 'none'">
                  {{ formatDate(vehicle.insuranceExpiry) }}
                  @if (daysUntil(vehicle.insuranceExpiry) !== null) {
                    <small>{{ daysLabel(vehicle.insuranceExpiry) }}</small>
                  }
                </span>
                <span class="row-actions" (click)="$event.stopPropagation()">
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Szerkesztés" (click)="openEdit(vehicle)">
                    <span appIcon="Pencil" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
      </div>

      @if (showCreate()) {
        <app-modal title="Jármű hozzáadása" description="Új jármű regisztrálása a flottában." size="lg" (close)="closeCreate()">
          <form class="modal-form" [formGroup]="form" (ngSubmit)="create()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Rendszám <small class="field-hint">auto, ha üres</small></span><input formControlName="licensePlate" placeholder="pl. ABC-123" /></label>
              <label class="field"><span class="field-label">Gyártmány <span class="req">*</span></span><input formControlName="manufacturer" /></label>
              <label class="field"><span class="field-label">Modell <span class="req">*</span></span><input formControlName="model" /></label>
              <label class="field"><span class="field-label">Évjárat</span><input type="number" formControlName="year" /></label>
              <label class="field"><span class="field-label">VIN / alvázszám</span><input formControlName="vin" /></label>
              <label class="field"><span class="field-label">Szín</span><input formControlName="color" placeholder="pl. Fehér" /></label>
              <label class="field"><span class="field-label">Üzemanyag</span>
                <select formControlName="fuelType">
                  <option value="">—</option>
                  @for (ft of fuelTypes; track ft.value) { <option [value]="ft.value">{{ ft.label }}</option> }
                </select>
              </label>
              <label class="field"><span class="field-label">Első forgalomba helyezés</span><input type="date" formControlName="registrationDate" /></label>
              <label class="field"><span class="field-label">Km óra állása</span><input type="number" formControlName="currentMileage" /></label>
              <label class="field"><span class="field-label">Következő szerviz (km)</span><input type="number" formControlName="nextServiceMileage" /></label>
              <label class="field"><span class="field-label">Műszaki vizsga lejárat</span><input type="date" formControlName="inspectionExpiry" /></label>
              <label class="field"><span class="field-label">Biztosítás lejárat</span><input type="date" formControlName="insuranceExpiry" /></label>
              <label class="field"><span class="field-label">Biztosítási kötvényszám</span><input formControlName="insurancePolicyNumber" /></label>
              <label class="field full"><span class="field-label">Megjegyzés</span><textarea formControlName="notes" rows="2"></textarea></label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Mégse</button>
            <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="form.invalid || saving()" (click)="create()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Mentés
            </button>
          </div>
        </app-modal>
      }

      @if (showEdit() && selected(); as v) {
        <app-modal [title]="v.licensePlate" [description]="v.manufacturer + ' ' + v.model" size="lg" (close)="closeEdit()">
          <div class="detail-section">
            <h3 class="section-title">Részletek</h3>
            <dl class="detail-dl">
              <dt>Jármű</dt><dd>{{ v.manufacturer }} {{ v.model }} ({{ v.year ?? '—' }})</dd>
              <dt>VIN</dt><dd>{{ v.vin || '—' }}</dd>
              <dt>Szín</dt><dd>{{ v.color || '—' }}</dd>
              <dt>Üzemanyag</dt><dd>{{ fuelTypeLabel(v.fuelType) }}</dd>
              <dt>Forgalomba helyezés</dt><dd>{{ formatDate(v.registrationDate) }}</dd>
              <dt>Km óra</dt><dd>{{ v.currentMileage.toLocaleString() }} km</dd>
              <dt>Állapot</dt><dd><span class="badge" [class.badge--good]="v.status === 'AVAILABLE'" [class.badge--info]="v.status === 'ASSIGNED'" [class.badge--warn]="v.status === 'SERVICE'">{{ statusLabel(v.status) }}</span></dd>
              <dt>Aktív</dt><dd>{{ v.active ? 'Igen' : 'Nem' }}</dd>
              <dt>Következő szerviz</dt><dd>{{ v.nextServiceMileage ? v.nextServiceMileage.toLocaleString() + ' km' : '—' }}</dd>
              <dt>Műszaki vizsga</dt>
              <dd>
                <span class="date-pill" [class.date--ok]="dateStatus(v.inspectionExpiry) === 'ok'" [class.date--warn]="dateStatus(v.inspectionExpiry) === 'warning'" [class.date--expired]="dateStatus(v.inspectionExpiry) === 'expired'" [class.date--none]="dateStatus(v.inspectionExpiry) === 'none'">
                  {{ formatDate(v.inspectionExpiry) }}{{ daysLabel(v.inspectionExpiry) ? ' · ' + daysLabel(v.inspectionExpiry) : '' }}
                </span>
              </dd>
              <dt>Biztosítás</dt>
              <dd>
                <span class="date-pill" [class.date--ok]="dateStatus(v.insuranceExpiry) === 'ok'" [class.date--warn]="dateStatus(v.insuranceExpiry) === 'warning'" [class.date--expired]="dateStatus(v.insuranceExpiry) === 'expired'" [class.date--none]="dateStatus(v.insuranceExpiry) === 'none'">
                  {{ formatDate(v.insuranceExpiry) }}{{ daysLabel(v.insuranceExpiry) ? ' · ' + daysLabel(v.insuranceExpiry) : '' }}
                </span>
                @if (v.insurancePolicyNumber) { <small class="col-muted"> · {{ v.insurancePolicyNumber }}</small> }
              </dd>
              @if (v.notes) { <dt>Megjegyzés</dt><dd>{{ v.notes }}</dd> }
            </dl>
          </div>

          <form class="modal-form" [formGroup]="updateForm" (ngSubmit)="update(v._id)">
            <div class="form-grid">
              <label class="field"><span class="field-label">Km óra állása</span><input type="number" formControlName="currentMileage" /></label>
              <label class="field"><span class="field-label">Következő szerviz (km)</span><input type="number" formControlName="nextServiceMileage" /></label>
              <label class="field"><span class="field-label">Állapot</span>
                <select formControlName="status">
                  <option value="AVAILABLE">Elérhető</option>
                  <option value="ASSIGNED">Kiosztva</option>
                  <option value="SERVICE">Szervizben</option>
                  <option value="INACTIVE">Inaktív</option>
                </select>
              </label>
              <label class="field"><span class="field-label">Szín</span><input formControlName="color" /></label>
              <label class="field"><span class="field-label">Üzemanyag</span>
                <select formControlName="fuelType">
                  <option value="">—</option>
                  @for (ft of fuelTypes; track ft.value) { <option [value]="ft.value">{{ ft.label }}</option> }
                </select>
              </label>
              <label class="field"><span class="field-label">Műszaki vizsga lejárat</span><input type="date" formControlName="inspectionExpiry" /></label>
              <label class="field"><span class="field-label">Biztosítás lejárat</span><input type="date" formControlName="insuranceExpiry" /></label>
              <label class="field"><span class="field-label">Biztosítási kötvényszám</span><input formControlName="insurancePolicyNumber" /></label>
              <label class="field"><span class="field-label">Első forgalomba helyezés</span><input type="date" formControlName="registrationDate" /></label>
              <label class="field full"><span class="field-label">Megjegyzés</span><textarea formControlName="notes" rows="2"></textarea></label>
            </div>
          </form>

          <div class="detail-section">
            <div class="section-head">
              <h3 class="section-title">Szerviz napló</h3>
              <button class="btn btn--secondary btn--sm" type="button" (click)="toggleAddLog()">
                <span appIcon="Plus" [size]="14"></span>Bejegyzés
              </button>
            </div>

            @if (showAddLog()) {
              <form class="log-form" [formGroup]="logForm" (ngSubmit)="addLog(v._id)">
                <div class="form-grid">
                  <label class="field"><span class="field-label">Dátum <span class="req">*</span></span><input type="date" formControlName="date" /></label>
                  <label class="field"><span class="field-label">Típus <span class="req">*</span></span>
                    <select formControlName="type">
                      @for (mt of maintenanceTypes; track mt.value) { <option [value]="mt.value">{{ mt.label }}</option> }
                    </select>
                  </label>
                  <label class="field"><span class="field-label">Km állás</span><input type="number" formControlName="mileageAtService" /></label>
                  <label class="field"><span class="field-label">Költség (Ft)</span><input type="number" formControlName="cost" /></label>
                  <label class="field full"><span class="field-label">Megjegyzés</span><input formControlName="notes" /></label>
                </div>
                <div class="log-form-actions">
                  <button class="btn btn--ghost btn--sm" type="button" (click)="toggleAddLog()">Mégse</button>
                  <button class="btn btn--secondary btn--sm" type="button" [class.btn--loading]="savingLog()" [disabled]="logForm.invalid || savingLog()" (click)="addLog(v._id)">
                    @if (savingLog()) { <span class="spinner"></span> } Mentés
                  </button>
                </div>
              </form>
            }

            @if (logs().length === 0) {
              <p class="empty-log">Még nincs szerviz bejegyzés.</p>
            } @else {
              <div class="log-list">
                @for (log of logs(); track log._id) {
                  <div class="log-item">
                    <div class="log-item-main">
                      <span class="log-type" [class.log-type--inspection]="log.type === 'inspection'">{{ maintenanceTypeLabel(log.type) }}</span>
                      <span class="log-date">{{ formatDate(log.date) }}</span>
                      <span class="col-muted">{{ log.mileageAtService.toLocaleString() }} km</span>
                      @if (log.cost) { <span class="col-muted">{{ log.cost.toLocaleString() }} Ft</span> }
                    </div>
                    @if (log.notes) { <small class="log-notes">{{ log.notes }}</small> }
                    <button class="btn--icon btn--subtle btn--sm log-delete" type="button" appTooltip="Törlés" (click)="removeLog(log._id)">
                      <span appIcon="Trash2" [size]="14"></span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <div slot="footer" class="modal-foot modal-foot--between">
            <div class="cluster">
              <button class="btn btn--danger" type="button" [class.btn--loading]="deleting()" (click)="remove(v._id)">
                @if (deleting()) { <span class="spinner"></span> } @else { <span appIcon="Trash2" [size]="16"></span> }
                Törlés
              </button>
              <button class="btn btn--ghost" type="button" (click)="printVehicle(v)">
                <span appIcon="Printer" [size]="16"></span>
                Címke nyomtatás
              </button>
            </div>
            <div class="cluster">
              <button class="btn btn--ghost" type="button" (click)="closeEdit()">Mégse</button>
              <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="updateForm.invalid || saving()" (click)="update(v._id)">
                @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
                Mentés
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

    .row { display: grid; grid-template-columns: .8fr 1.4fr .7fr .7fr .9fr .9fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row:not(.head) { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .row:not(.head):hover { background: var(--surface-hover); }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .date-cell { display: flex; flex-direction: column; font-size: 13px; padding: 2px 8px; border-radius: var(--radius-sm); }
    .date-cell small { font-size: 11px; color: var(--muted); }
    .date--ok { color: var(--success); }
    .date--warn { color: var(--warn); background: var(--warn-soft); }
    .date--expired { color: var(--danger); background: var(--danger-soft); font-weight: 600; }
    .date--none { color: var(--muted); }

    .date-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: var(--radius-sm); font-size: 13px; }
    .date-pill.date--ok { color: var(--success); background: var(--success-soft); }
    .date-pill.date--warn { color: var(--warn); background: var(--warn-soft); }
    .date-pill.date--expired { color: var(--danger); background: var(--danger-soft); font-weight: 600; }
    .date-pill.date--none { color: var(--muted); }

    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .field.full { grid-column: 1 / -1; }
    textarea { resize: vertical; font-family: inherit; }

    .detail-section { margin-top: var(--space-5); }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin: 0 0 var(--space-3); }
    .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
    .section-head .section-title { margin: 0; }

    .detail-dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-4); }
    .detail-dl dt { color: var(--muted); font-size: 13px; font-weight: 600; }
    .detail-dl dd { margin: 0; font-size: 14px; }

    .log-form { border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-4); background: var(--surface-soft); }
    .log-form-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }

    .log-list { display: flex; flex-direction: column; gap: var(--space-2); }
    .log-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border: 1px solid var(--line-soft); border-radius: var(--radius-sm); background: var(--surface); position: relative; }
    .log-item:hover { background: var(--surface-hover); }
    .log-item-main { display: flex; align-items: center; gap: var(--space-3); flex: 1; flex-wrap: wrap; font-size: 13px; }
    .log-type { font-weight: 600; padding: 1px 8px; border-radius: var(--radius-sm); background: var(--brand-soft); color: var(--brand-ink); font-size: 12px; }
    .log-type--inspection { background: var(--info-soft); color: var(--info); }
    .log-date { font-weight: 600; }
    .log-notes { color: var(--muted); flex: 1; }
    .log-delete { opacity: 0; transition: opacity var(--dur-fast); }
    .log-item:hover .log-delete { opacity: 1; }
    .empty-log { color: var(--muted); font-size: 14px; padding: var(--space-3); text-align: center; }

    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr; }
      .form-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3), .row span:nth-child(5), .row span:nth-child(6) { display: none; }
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
  readonly logs = signal<MaintenanceLog[]>([]);
  readonly showCreate = signal(false);
  readonly showEdit = signal(false);
  readonly showAddLog = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly savingLog = signal(false);
  readonly deleting = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly maintenanceTypes = MAINTENANCE_TYPES;
  readonly fuelTypes = FUEL_TYPES;

  readonly form = this.fb.nonNullable.group({
    licensePlate: [''],
    manufacturer: ['', Validators.required],
    model: ['', Validators.required],
    year: [2026],
    vin: [''],
    color: [''],
    fuelType: [''],
    registrationDate: [''],
    currentMileage: [0],
    nextServiceMileage: [''],
    inspectionExpiry: [''],
    insuranceExpiry: [''],
    insurancePolicyNumber: [''],
    notes: ['']
  });
  readonly updateForm = this.fb.nonNullable.group({
    currentMileage: [0],
    nextServiceMileage: [''],
    status: ['AVAILABLE'],
    color: [''],
    fuelType: [''],
    registrationDate: [''],
    inspectionExpiry: [''],
    insuranceExpiry: [''],
    insurancePolicyNumber: [''],
    notes: ['']
  });
  readonly logForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    type: ['oil', Validators.required],
    mileageAtService: [0],
    cost: [''],
    notes: ['']
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
    this.form.reset({ licensePlate: '', manufacturer: '', model: '', year: 2026, vin: '', color: '', fuelType: '', registrationDate: '', currentMileage: 0, nextServiceMileage: '', inspectionExpiry: '', insuranceExpiry: '', insurancePolicyNumber: '', notes: '' });
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  create() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = { ...raw };
    if (payload['nextServiceMileage'] === '' || payload['nextServiceMileage'] == null) {
      delete payload['nextServiceMileage'];
    } else {
      payload['nextServiceMileage'] = Number(payload['nextServiceMileage']);
    }
    this.api.post<Vehicle>('/vehicles', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.toasts.success('Jármű elmentve.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült menteni a járművet.');
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
        this.updateForm.patchValue({
          currentMileage: fresh.currentMileage,
          nextServiceMileage: fresh.nextServiceMileage != null ? String(fresh.nextServiceMileage) : '',
          status: fresh.status,
          color: fresh.color ?? '',
          fuelType: fresh.fuelType ?? '',
          registrationDate: toDateStr(fresh.registrationDate) ?? '',
          inspectionExpiry: toDateStr(fresh.inspectionExpiry) ?? '',
          insuranceExpiry: toDateStr(fresh.insuranceExpiry) ?? '',
          insurancePolicyNumber: fresh.insurancePolicyNumber ?? '',
          notes: fresh.notes ?? ''
        });
        this.showEdit.set(true);
        this.showAddLog.set(false);
        this.loadLogs(fresh._id);
      }
    });
  }

  closeEdit() {
    this.showEdit.set(false);
    this.showAddLog.set(false);
    this.selected.set(null);
    this.logs.set([]);
  }

  update(id: string) {
    if (this.updateForm.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.updateForm.getRawValue();
    const payload: Record<string, unknown> = { ...raw };
    if (payload['nextServiceMileage'] === '' || payload['nextServiceMileage'] == null) {
      delete payload['nextServiceMileage'];
    } else {
      payload['nextServiceMileage'] = Number(payload['nextServiceMileage']);
    }
    this.api.patch<Vehicle>(`/vehicles/${id}`, payload).subscribe({
      next: (vehicle) => {
        this.saving.set(false);
        this.selected.set(vehicle);
        this.toasts.success('Jármű frissítve.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült frissíteni a járművet.');
      }
    });
  }

  async remove(id: string) {
    const ok = await this.confirm.confirm({
      title: 'Jármű törlése?',
      message: 'Ez véglegesen eltávolítja a járművet és a hozzá tartozó előzményeket. A művelet nem visszavonható.',
      confirmLabel: 'Törlés',
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
        this.toasts.success('Jármű törölve.');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.toasts.error('Nem sikerült törölni a járművet.');
      }
    });
  }

  loadLogs(vehicleId: string) {
    this.api.get<MaintenanceLog[]>(`/vehicle-maintenance-logs?vehicleId=${vehicleId}`).subscribe({
      next: (logs) => this.logs.set(logs),
      error: () => this.logs.set([])
    });
  }

  toggleAddLog() {
    this.showAddLog.update((v) => !v);
    if (this.showAddLog()) {
      const v = this.selected();
      this.logForm.reset({
        date: new Date().toISOString().slice(0, 10),
        type: 'oil',
        mileageAtService: v?.currentMileage ?? 0,
        cost: '',
        notes: ''
      });
    }
  }

  addLog(vehicleId: string) {
    if (this.logForm.invalid || this.savingLog()) return;
    this.savingLog.set(true);
    const raw = this.logForm.getRawValue();
    const payload: Record<string, unknown> = {
      vehicleId,
      date: raw['date'],
      type: raw['type'],
      mileageAtService: Number(raw['mileageAtService']) || 0,
      notes: raw['notes'] || undefined
    };
    if (raw['cost']) payload['cost'] = Number(raw['cost']);
    this.api.post<MaintenanceLog>('/vehicle-maintenance-logs', payload).subscribe({
      next: () => {
        this.savingLog.set(false);
        this.toasts.success('Szerviz bejegyzés hozzáadva.');
        this.loadLogs(vehicleId);
        this.showAddLog.set(false);
      },
      error: () => {
        this.savingLog.set(false);
        this.toasts.error('Nem sikerült menteni a bejegyzést.');
      }
    });
  }

  async removeLog(logId: string) {
    const ok = await this.confirm.confirm({
      title: 'Bejegyzés törlése?',
      message: 'Biztosan törlöd ezt a szerviz bejegyzést?',
      confirmLabel: 'Törlés',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.api.delete(`/vehicle-maintenance-logs/${logId}`).subscribe({
      next: () => {
        const v = this.selected();
        if (v) this.loadLogs(v._id);
        this.toasts.success('Bejegyzés törölve.');
      },
      error: () => this.toasts.error('Nem sikerült törölni a bejegyzést.')
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

  statusLabel(status: string): string {
    const map: Record<string, string> = { AVAILABLE: 'Elérhető', ASSIGNED: 'Kiosztva', SERVICE: 'Szerviz', INACTIVE: 'Inaktív' };
    return map[status] ?? status;
  }

  fuelTypeLabel(type?: string): string {
    return FUEL_TYPES.find((ft) => ft.value === type)?.label ?? '—';
  }

  maintenanceTypeLabel(type: string): string {
    return MAINTENANCE_TYPES.find((mt) => mt.value === type)?.label ?? type;
  }

  formatDate = formatDate;
  dateStatus = dateStatus;
  daysUntil = daysUntil;

  daysLabel(value?: string | Date): string {
    const days = daysUntil(value);
    if (days === null) return '';
    if (days < 0) return `${Math.abs(days)} napja lejárt`;
    if (days === 0) return 'ma lejár';
    if (days <= 30) return `${days} nap múlva`;
    return '';
  }
}
