import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective, AppIconName } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';

interface UpdateSummary {
  _id: string;
  buildName: string;
  version: string;
  buildNumber: number;
  releasedAt: string;
  changeCount: number;
}

interface UpdateChange {
  _id: string;
  type: string;
  title: string;
  description?: string;
}

interface UpdateDetail extends UpdateSummary {
  changes: UpdateChange[];
}

type LoadState = 'loading' | 'ready' | 'error';

const CHANGE_TYPES: { value: string; label: string; icon: AppIconName; color: string }[] = [
  { value: 'feature', label: 'Új funkció', icon: 'Sparkles', color: 'var(--success)' },
  { value: 'improvement', label: 'Fejlesztés', icon: 'TrendingUp', color: 'var(--info)' },
  { value: 'fix', label: 'Hibajavítás', icon: 'Wrench', color: 'var(--warn)' },
  { value: 'breaking', label: 'Törő változás', icon: 'TriangleAlert', color: 'var(--danger)' },
  { value: 'security', label: 'Biztonság', icon: 'ShieldCheck', color: 'var(--brand)' }
];

function changeTypeMeta(type: string) {
  return CHANGE_TYPES.find((t) => t.value === type) ?? CHANGE_TYPES[CHANGE_TYPES.length - 1];
}

@Component({
  selector: 'app-updates',
  standalone: true,
  imports: [DatePipe, IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Frissítések</h1>
          <p>{{ updates().length }} kiadott build — kattints egy buildre a részletekért.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Frissítés">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Frissítés
          </button>
          @if (canManage()) {
            <button class="btn btn--secondary" type="button" (click)="openCreate()">
              <span appIcon="Plus" [size]="16"></span>Új build
            </button>
          }
        </div>
      </div>

      <div class="table-shell">
        <div class="table-title">
          <h2>Build történet</h2>
          <span class="table-meta">{{ updates().length }} db</span>
        </div>
        <div class="table-scroll">
          @if (state() === 'loading') {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 12%"></span>
                  <span class="skeleton skeleton--line" style="width: 25%"></span>
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                </div>
              }
            </div>
          } @else if (state() === 'error') {
            <div class="state-card is-error">
              <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
              <h3>Nem sikerült betölteni</h3>
              <p>Valami hiba történt a frissítések lekérésekor.</p>
              <button class="btn btn--ghost" type="button" (click)="load()"><span appIcon="RefreshCw" [size]="16"></span>Újra</button>
            </div>
          } @else if (updates().length === 0) {
            <app-empty-state icon="Sparkles" title="Még nincs kiadott build" description="A kiadott buildek és változásnaplók itt fognak megjelenni.">
              @if (canManage()) {
                <button class="btn btn--secondary" type="button" (click)="openCreate()"><span appIcon="Plus" [size]="16"></span>Új build hozzáadása</button>
              }
            </app-empty-state>
          } @else {
            <div class="row head">
              <span>Build #</span><span>Név</span><span>Verzió</span><span>Változások</span><span>Dátum</span><span></span>
            </div>
            @for (update of updates(); track update._id) {
              <div class="row clickable" (click)="openDetail(update._id)">
                <strong class="mono">#{{ update.buildNumber }}</strong>
                <span class="truncate"><strong>{{ update.buildName }}</strong></span>
                <span class="col-muted mono">v{{ update.version }}</span>
                <span class="col-muted">{{ update.changeCount }} változás</span>
                <span class="col-muted">{{ update.releasedAt | date: 'yyyy-MM-dd' }}</span>
                <span class="row-actions" (click)="$event.stopPropagation()">
                  @if (canManage()) {
                    <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Törlés" (click)="remove(update._id, update.buildName)">
                      <span appIcon="Trash2" [size]="16"></span>
                    </button>
                  }
                </span>
              </div>
            }
          }
        </div>
      </div>

      @if (showDetail() && detail(); as d) {
        <app-modal [title]="'#' + d.buildNumber + ' ' + d.buildName" [description]="'v' + d.version + ' · ' + (d.releasedAt | date: 'yyyy-MM-dd')" size="lg" (close)="closeDetail()">
          <div class="change-list">
            @if (d.changes.length === 0) {
              <p class="empty-changes">Nincsenek rögzített változások ehhez a buildhez.</p>
            } @else {
              @for (change of d.changes; track change._id) {
                <div class="change-item">
                  <span class="change-icon" [style.color]="changeTypeMeta(change.type).color" [appIcon]="changeTypeMeta(change.type).icon" [size]="18"></span>
                  <div class="change-body">
                    <div class="change-header">
                      <span class="change-type-badge" [style.--badge-color]="changeTypeMeta(change.type).color">{{ changeTypeMeta(change.type).label }}</span>
                      <strong>{{ change.title }}</strong>
                    </div>
                    @if (change.description) {
                      <p class="change-desc">{{ change.description }}</p>
                    }
                  </div>
                </div>
              }
            }
          </div>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeDetail()">Bezárás</button>
          </div>
        </app-modal>
      }

      @if (showCreate()) {
        <app-modal title="Új build hozzáadása" description="Kreatív név, verzió és változáslista megadása." size="lg" (close)="closeCreate()">
          <form [formGroup]="createForm" (ngSubmit)="create()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Build név <span class="req">*</span></span><input formControlName="buildName" placeholder="pl. Vulpes Vulpes" /></label>
              <label class="field"><span class="field-label">Verzió <span class="req">*</span></span><input formControlName="version" placeholder="pl. 0.2.0" /></label>
              <label class="field"><span class="field-label">Build szám <span class="req">*</span></span><input type="number" formControlName="buildNumber" /></label>
              <label class="field"><span class="field-label">Kiadás dátuma <span class="req">*</span></span><input type="date" formControlName="releasedAt" /></label>
            </div>

            <div class="changes-section">
              <div class="changes-head">
                <h3 class="section-title">Változások</h3>
                <button class="btn btn--secondary btn--sm" type="button" (click)="addChangeRow()">
                  <span appIcon="Plus" [size]="14"></span>Sor hozzáadása
                </button>
              </div>

              @for (ctrl of changeControls(); track ctrl; let i = $index) {
                <div class="change-row" [formGroup]="ctrl">
                  <label class="field field-type">
                    <span class="field-label">Típus</span>
                    <select formControlName="type">
                      @for (ct of changeTypes; track ct.value) { <option [value]="ct.value">{{ ct.label }}</option> }
                    </select>
                  </label>
                  <label class="field field-title">
                    <span class="field-label">Cím <span class="req">*</span></span>
                    <input formControlName="title" placeholder="pl. Járművek színkódolt lejárat jelzés" />
                  </label>
                  <label class="field field-desc">
                    <span class="field-label">Leírás</span>
                    <input formControlName="description" placeholder="Részletes leírás (opcionális)" />
                  </label>
                  <button class="btn--icon btn--subtle btn--sm change-remove" type="button" appTooltip="Sor törlése" (click)="removeChangeRow(i)">
                    <span appIcon="X" [size]="16"></span>
                  </button>
                </div>
              }
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Mégse</button>
            <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="createForm.invalid || saving()" (click)="create()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Mentés
            </button>
          </div>
        </app-modal>
      }
    </section>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: .6fr 1.4fr .8fr .8fr .8fr 56px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row.clickable { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .row.clickable:hover { background: var(--surface-hover); }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .change-list { display: flex; flex-direction: column; gap: var(--space-3); }
    .change-item { display: flex; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--line-soft); border-radius: var(--radius); background: var(--surface); }
    .change-icon { flex-shrink: 0; margin-top: 2px; }
    .change-body { flex: 1; min-width: 0; }
    .change-header { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .change-type-badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--badge-color) 15%, transparent); color: var(--badge-color); text-transform: uppercase; letter-spacing: 0.02em; }
    .change-desc { margin: var(--space-1) 0 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
    .empty-changes { color: var(--muted); text-align: center; padding: var(--space-4); }

    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }

    .changes-section { border-top: 1px solid var(--line); padding-top: var(--space-4); }
    .changes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin: 0; }

    .change-row { display: grid; grid-template-columns: 140px 1fr 1fr 36px; gap: var(--space-2); align-items: end; margin-bottom: var(--space-2); }
    .change-remove { margin-bottom: var(--space-3); }

    @media (max-width: 900px) {
      .form-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3), .row span:nth-child(4) { display: none; }
      .row.head { display: none; }
      .change-row { grid-template-columns: 1fr; }
    }
  `]
})
export class UpdatesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly updates = signal<UpdateSummary[]>([]);
  readonly detail = signal<UpdateDetail | null>(null);
  readonly showDetail = signal(false);
  readonly showCreate = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly skeletons = [1, 2, 3, 4, 5];
  readonly changeTypes = CHANGE_TYPES;
  changeTypeMeta = changeTypeMeta;

  readonly createForm = this.fb.group({
    buildName: ['', Validators.required],
    version: ['', Validators.required],
    buildNumber: ['', [Validators.required, Validators.min(1)]],
    releasedAt: ['', Validators.required],
    changes: this.fb.array<FormGroup>([])
  });

  changeControls(): FormGroup[] {
    return (this.createForm.get('changes') as FormArray<FormGroup>).controls;
  }

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });
  }

  canManage(): boolean {
    const user = this.auth.user();
    const isAdmin = user?.platformAdmin === true || user?.superAdmin === true;
    const ws = this.tenants.activeWorkspace();
    return isAdmin || (ws?.permissions.includes('updates.manage') ?? false);
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.state.set('loading');
    this.api.get<UpdateSummary[]>('/updates').subscribe({
      next: (updates) => {
        this.updates.set(updates);
        this.loading.set(false);
        this.state.set('ready');
      },
      error: () => {
        this.loading.set(false);
        this.state.set('error');
      }
    });
  }

  openDetail(id: string) {
    this.api.get<UpdateDetail>(`/updates/${id}`).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.showDetail.set(true);
      },
      error: () => this.toasts.error('Nem sikerült betölteni a build részleteit.')
    });
  }

  closeDetail() {
    this.showDetail.set(false);
    this.detail.set(null);
  }

  openCreate() {
    this.createForm.reset({
      buildName: '',
      version: '',
      buildNumber: '',
      releasedAt: new Date().toISOString().slice(0, 10)
    });
    (this.createForm.get('changes') as FormArray<FormGroup>).clear();
    this.addChangeRow();
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  addChangeRow() {
    (this.createForm.get('changes') as FormArray<FormGroup>).push(
      this.fb.group({
        type: ['feature', Validators.required],
        title: ['', Validators.required],
        description: ['']
      })
    );
  }

  removeChangeRow(index: number) {
    (this.createForm.get('changes') as FormArray<FormGroup>).removeAt(index);
  }

  create() {
    if (this.createForm.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.createForm.getRawValue();
    const changes = (raw['changes'] as { type: string; title: string; description: string }[])
      .filter((c) => c.title?.trim())
      .map((c) => ({ type: c.type, title: c.title, description: c.description || undefined }));
    const payload = {
      buildName: raw['buildName'],
      version: raw['version'],
      buildNumber: Number(raw['buildNumber']),
      releasedAt: raw['releasedAt'],
      changes
    };
    this.api.post<UpdateDetail>('/updates', payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.toasts.success('Build létrehozva.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Nem sikerült létrehozni a buildet.');
      }
    });
  }

  async remove(id: string, name: string) {
    const ok = await this.confirm.confirm({
      title: 'Build törlése?',
      message: `Biztosan törlöd a "${name}" buildet és az összes változás bejegyzését?`,
      confirmLabel: 'Törlés',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.api.delete(`/updates/${id}`).subscribe({
      next: () => {
        this.toasts.success('Build törölve.');
        this.load();
      },
      error: () => this.toasts.error('Nem sikerült törölni a buildet.')
    });
  }
}
