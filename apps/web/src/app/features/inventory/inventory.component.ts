import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective, AppIconName } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';
import { printLabel } from '../../shared/ui/print-label';

interface InventoryItem {
  _id: string;
  name: string;
  inventoryNumber: string;
  type: string;
  categoryId?: string;
  description?: string;
  serialNumber?: string;
  quantity: number;
  availableQuantity: number;
  lowStockThreshold?: number;
  unit?: string;
  status: string;
  location?: string;
  notes?: string;
}

interface InventoryCategory {
  _id: string;
  name: string;
  code?: string;
}

interface InventoryTransaction {
  _id: string;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  timestamp: string;
  notes?: string;
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

type LoadState = 'loading' | 'ready' | 'error';

interface InventoryListStats {
  totalItems: number;
  availableUnits: number;
  assignedUnits: number;
  lowStockCount: number;
}

interface PaginatedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: InventoryListStats;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [DatePipe, IconDirective, TooltipDirective, ReactiveFormsModule, ModalComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Inventory</h1>
          <p>{{ stats().totalItems }} items · {{ stats().lowStockCount }} low-stock records · {{ stats().availableUnits }} available units</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Refresh">
            @if (loading()) { <span class="spinner" aria-hidden="true"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Refresh
          </button>
          <button class="btn btn--ghost" type="button" (click)="openCategories()" appTooltip="Manage categories">
            <span appIcon="FolderTree" [size]="16"></span>
            Categories
          </button>
          <button class="btn btn--primary" type="button" (click)="openCreate()">
            <span appIcon="Plus" [size]="16"></span>Add item
          </button>
        </div>
      </div>

      <div class="metrics">
        <article class="mini-metric">
          <span class="mini-icon" appIcon="Boxes" [size]="18"></span>
          <div><small>Total items</small><strong>{{ stats().totalItems }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon good" appIcon="CircleCheck" [size]="18"></span>
          <div><small>Available units</small><strong>{{ stats().availableUnits }}</strong></div>
        </article>
        <article class="mini-metric">
          <span class="mini-icon info" appIcon="ClipboardCheck" [size]="18"></span>
          <div><small>Assigned units</small><strong>{{ stats().assignedUnits }}</strong></div>
        </article>
      </div>

      <div class="filter-bar">
        <div class="input-affix search-field">
          <span class="affix-icon" appIcon="Search" [size]="16"></span>
          <input type="text" [value]="search()" (input)="onSearchInput($any($event.target).value)" placeholder="Search inventory…" />
        </div>
        <label class="field filter-field">
          <span class="field-label">Category</span>
          <select [value]="categoryFilter()" (change)="categoryFilter.set($any($event.target).value)">
            <option value="">All categories</option>
            @for (category of categories(); track category._id) {
              <option [value]="category._id">{{ category.name }}</option>
            }
          </select>
        </label>
        <label class="field page-size-field">
          <span class="field-label">Per page</span>
          <select [value]="pageSize()" (change)="changePageSize($any($event.target).value)">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>

      <div class="table-shell">
        <div class="table-title">
          <h2>Stock list</h2>
          <span class="table-meta">{{ total() }} records</span>
        </div>
        <div class="table-scroll">
          @if (state() === 'loading') {
            <div class="skeleton-list">
              @for (i of skeletons; track i) {
                <div class="skeleton-row">
                  <span class="skeleton skeleton--line" style="width: 28%"></span>
                  <span class="skeleton skeleton--line" style="width: 18%"></span>
                  <span class="skeleton skeleton--line" style="width: 14%"></span>
                  <span class="skeleton skeleton--line" style="width: 12%"></span>
                </div>
              }
            </div>
          } @else if (state() === 'error') {
            <div class="state-card is-error">
              <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
              <h3>Couldn't load inventory</h3>
              <p>Something went wrong while fetching the stock list. Please try again.</p>
              <button class="btn btn--ghost" type="button" (click)="load()"><span appIcon="RefreshCw" [size]="16"></span>Try again</button>
            </div>
          } @else if (items().length === 0) {
            <app-empty-state icon="Boxes" title="No inventory items found" [description]="search() ? 'No items match your search. Try different keywords.' : 'Add your first inventory item to start tracking warehouse stock.'">
              @if (!search()) {
                <button class="btn btn--primary" type="button" (click)="openCreate()"><span appIcon="Plus" [size]="16"></span>Add item</button>
              }
            </app-empty-state>
          } @else {
            <div class="row head">
              <span>Name</span><span>Number</span><span>Category</span><span>Type</span><span>Available</span><span>Status</span><span></span>
            </div>
            @for (item of items(); track item._id) {
              <div class="row" [class.selected]="selected()?._id === item._id" (click)="select(item)">
                <span class="col-strong truncate">{{ item.name }}</span>
                <span class="col-muted mono">{{ item.inventoryNumber }}</span>
                <span class="col-muted truncate">{{ categoryName(item.categoryId) }}</span>
                <span class="badge badge--muted">{{ item.type }}</span>
                <span>{{ item.availableQuantity }} / {{ item.quantity }}</span>
                <span class="badge" [class.badge--good]="item.status === 'AVAILABLE'" [class.badge--warn]="item.availableQuantity === 0 && item.status !== 'SCRAPPED'">{{ item.status }}</span>
                <span class="row-actions" (click)="$event.stopPropagation()">
                  <button class="btn--icon btn--subtle btn--sm" type="button" [disabled]="item.availableQuantity === 0" appTooltip="Assign" (click)="startAssign(item)">
                    <span appIcon="Send" [size]="16"></span>
                  </button>
                  <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="openEdit(item)">
                    <span appIcon="Pencil" [size]="16"></span>
                  </button>
                </span>
              </div>
            }
          }
        </div>
        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--ghost btn--sm" type="button" [disabled]="page() === 1 || loading()" (click)="goToPage(page() - 1)">
              <span appIcon="ChevronLeft" [size]="16"></span> Prev
            </button>
            <span class="pagination-info">Page {{ page() }} of {{ totalPages() }}</span>
            <button class="btn btn--ghost btn--sm" type="button" [disabled]="page() >= totalPages() || loading()" (click)="goToPage(page() + 1)">
              Next <span appIcon="ChevronRight" [size]="16"></span>
            </button>
          </div>
        }
      </div>

      <!-- Create modal -->
      @if (showCreate()) {
        <app-modal title="Add inventory item" description="Create a new stock or asset record." size="lg" (close)="closeCreate()">
          <form class="modal-form" [formGroup]="createForm" (ngSubmit)="create()">
            <div class="form-grid">
              <label class="field"><span class="field-label">Name <span class="req">*</span></span><input formControlName="name" /></label>
              <label class="field"><span class="field-label">Type</span>
                <select formControlName="type"><option value="QUANTITY">Quantity</option><option value="ASSET">Asset</option></select>
              </label>
              <label class="field"><span class="field-label">Quantity <span class="req">*</span></span><input type="number" min="1" formControlName="quantity" /></label>
              <label class="field"><span class="field-label">Unit</span><input formControlName="unit" /></label>
              <label class="field"><span class="field-label">Location</span><input formControlName="location" /></label>
              <label class="field"><span class="field-label">Category</span>
                <select formControlName="categoryId">
                  <option value="">No category</option>
                  @for (category of categories(); track category._id) {
                    <option [value]="category._id">{{ category.name }}</option>
                  }
                </select>
              </label>
              <label class="field"><span class="field-label">Low stock threshold</span><input type="number" min="0" formControlName="lowStockThreshold" /></label>
              <label class="field"><span class="field-label">Serial number</span><input formControlName="serialNumber" /></label>
              <label class="field full"><span class="field-label">Description</span><textarea formControlName="description" rows="2"></textarea></label>
              <label class="field full"><span class="field-label">Notes</span><textarea formControlName="notes" rows="2"></textarea></label>
            </div>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeCreate()">Cancel</button>
            <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="createForm.invalid || saving()" (click)="create()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
              Save item
            </button>
          </div>
        </app-modal>
      }

      <!-- Edit modal -->
      @if (showEdit() && selected(); as item) {
        <app-modal [title]="item.name" [description]="item.inventoryNumber" size="lg" (close)="closeEdit()">
          <div class="detail-grid">
            <dl>
              <dt>Type</dt><dd>{{ item.type }}</dd>
              <dt>Category</dt><dd>{{ categoryName(item.categoryId) }}</dd>
              <dt>Available</dt><dd>{{ item.availableQuantity }} / {{ item.quantity }}</dd>
              <dt>Status</dt><dd><span class="badge" [class.badge--good]="item.status === 'AVAILABLE'">{{ item.status }}</span></dd>
              <dt>Low stock threshold</dt><dd>{{ item.lowStockThreshold ?? 5 }}</dd>
              <dt>Location</dt><dd>{{ item.location || '-' }}</dd>
              <dt>Serial number</dt><dd>{{ item.serialNumber || '-' }}</dd>
              <dt>Description</dt><dd>{{ item.description || '-' }}</dd>
              <dt>Notes</dt><dd>{{ item.notes || '-' }}</dd>
            </dl>
            <form class="modal-form" [formGroup]="editForm" (ngSubmit)="update(item._id)">
              <div class="form-grid">
                <label class="field"><span class="field-label">Name <span class="req">*</span></span><input formControlName="name" /></label>
                <label class="field"><span class="field-label">Type</span><select formControlName="type"><option value="QUANTITY">Quantity</option><option value="ASSET">Asset</option></select></label>
                <label class="field"><span class="field-label">Quantity <span class="req">*</span></span><input type="number" min="0" formControlName="quantity" /></label>
                <label class="field"><span class="field-label">Unit</span><input formControlName="unit" /></label>
                <label class="field"><span class="field-label">Location</span><input formControlName="location" /></label>
                <label class="field"><span class="field-label">Category</span>
                  <select formControlName="categoryId">
                    <option value="">No category</option>
                    @for (category of categories(); track category._id) {
                      <option [value]="category._id">{{ category.name }}</option>
                    }
                  </select>
                </label>
                <label class="field"><span class="field-label">Low stock threshold</span><input type="number" min="0" formControlName="lowStockThreshold" /></label>
                <label class="field"><span class="field-label">Status</span>
                  <select formControlName="status">
                    <option value="AVAILABLE">Available</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="LOST">Lost</option>
                    <option value="SCRAPPED">Scrapped</option>
                  </select>
                </label>
                <label class="field"><span class="field-label">Serial number</span><input formControlName="serialNumber" /></label>
                <label class="field full"><span class="field-label">Description</span><textarea formControlName="description" rows="2"></textarea></label>
                <label class="field full"><span class="field-label">Notes</span><textarea formControlName="notes" rows="2"></textarea></label>
              </div>
            </form>

            <div class="transactions">
              <h3>History</h3>
              @if (transactions().length === 0) {
                <p class="muted">No transactions yet.</p>
              } @else {
                @for (tx of transactions(); track tx._id) {
                  <div class="transaction-row">
                    <span class="badge badge--brand">{{ tx.type }}</span>
                    <span class="mono">{{ tx.previousQuantity }} → {{ tx.newQuantity }}</span>
                    <span class="muted">{{ tx.timestamp | date: 'short' }}</span>
                  </div>
                }
              }
            </div>
          </div>
          <div slot="footer" class="modal-foot modal-foot--between">
            <div class="cluster">
              <button class="btn btn--danger" type="button" [class.btn--loading]="deleting()" (click)="remove(item._id)">
                @if (deleting()) { <span class="spinner"></span> } @else { <span appIcon="Trash2" [size]="16"></span> }
                Delete
              </button>
              <button class="btn btn--ghost" type="button" (click)="printItem(item)">
                <span appIcon="Printer" [size]="16"></span>
                Print label
              </button>
            </div>
            <div class="cluster">
              <button class="btn btn--ghost" type="button" (click)="closeEdit()">Cancel</button>
              <button class="btn btn--primary" type="button" [class.btn--loading]="saving()" [disabled]="editForm.invalid || saving()" (click)="update(item._id)">
                @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
                Update
              </button>
            </div>
          </div>
        </app-modal>
      }

      <!-- Assign modal -->
      @if (assigning(); as item) {
        <app-modal [title]="'Assign ' + item.name" [description]="item.inventoryNumber" size="sm" (close)="closeAssign()">
          <form class="modal-form" [formGroup]="assignForm" (ngSubmit)="assign()">
            <label class="field"><span class="field-label">Issue to</span>
              <select formControlName="targetType"><option value="EMPLOYEE">Employee</option><option value="VEHICLE">Vehicle</option></select>
            </label>
            <label class="field"><span class="field-label">Target</span>
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
            <label class="field"><span class="field-label">Quantity</span><input type="number" min="1" formControlName="quantity" /></label>
          </form>
          <div slot="footer" class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="closeAssign()">Cancel</button>
            <button class="btn btn--secondary" type="button" [class.btn--loading]="saving()" [disabled]="assignForm.invalid || saving()" (click)="assign()">
              @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Send" [size]="16"></span> }
              Assign
            </button>
          </div>
        </app-modal>
      }

      @if (showCategories()) {
        <app-modal title="Inventory categories" description="Create and manage categories for organizing stock." size="md" (close)="closeCategories()">
          <div class="category-list">
            @if (categories().length === 0) {
              <p class="muted">No categories yet. Create one below.</p>
            }
            @for (category of categories(); track category._id) {
              <div class="category-row">
                @if (editingCategoryId() === category._id) {
                  <input class="category-edit-input" [value]="editingCategoryName()" (input)="editingCategoryName.set($any($event.target).value)" />
                  <div class="cluster">
                    <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Save" (click)="saveCategoryEdit(category._id)">
                      <span appIcon="Check" [size]="14"></span>
                    </button>
                    <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Cancel" (click)="cancelCategoryEdit()">
                      <span appIcon="X" [size]="14"></span>
                    </button>
                  </div>
                } @else {
                  <span class="category-name">{{ category.name }}</span>
                  @if (category.code) { <span class="badge badge--muted">{{ category.code }}</span> }
                  <div class="cluster">
                    <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Edit" (click)="startCategoryEdit(category)">
                      <span appIcon="Pencil" [size]="14"></span>
                    </button>
                    <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Delete" (click)="deleteCategory(category)">
                      <span appIcon="Trash2" [size]="14"></span>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
          <form class="category-add" [formGroup]="categoryForm" (ngSubmit)="createCategory()">
            <input formControlName="name" placeholder="New category name…" />
            <input formControlName="code" placeholder="Code (optional)" />
            <button class="btn btn--primary btn--sm" type="submit" [class.btn--loading]="savingCategory()" [disabled]="categoryForm.invalid || savingCategory()">
              @if (savingCategory()) { <span class="spinner"></span> } @else { <span appIcon="Plus" [size]="14"></span> }
              Add
            </button>
          </form>
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
    .mini-metric small { color: var(--muted); display: block; font-size: 13px; }
    .mini-metric strong { font-size: 22px; font-weight: 700; color: var(--ink-strong); }

    .filter-bar { display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; }
    .search-field { flex: 1; min-width: 220px; }
    .filter-field { min-width: 200px; }
    .page-size-field { min-width: 120px; }
    .filter-field .field-label, .page-size-field .field-label { display: block; }

    .pagination {
      display: flex; align-items: center; justify-content: center; gap: var(--space-4);
      padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft);
    }
    .pagination-info { color: var(--muted); font-size: 13px; }

    .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr .8fr .8fr .8fr 80px; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft); align-items: center; }
    .row:first-child { border-top: 0; }
    .row:not(.head) { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .row:not(.head):hover { background: var(--surface-hover); }
    .row.selected { background: var(--brand-soft); }
    .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .skeleton-list { padding: 0; }

    .modal-form { display: grid; gap: var(--space-4); }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .field.full { grid-column: 1 / -1; }

    .detail-grid { display: grid; gap: var(--space-5); }
    dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2) var(--space-4); margin: 0; padding: var(--space-4); background: var(--surface-soft); border-radius: var(--radius); }
    dt { color: var(--muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    dd { margin: 0; font-size: 14px; }

    .transactions { display: grid; gap: var(--space-2); }
    .transactions h3 { font-size: 14px; }
    .transaction-row {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface-soft);
    }
    .transaction-row .muted { margin-left: auto; font-size: 12px; }

    @media (max-width: 900px) {
      .metrics { grid-template-columns: 1fr; }
      .form-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr 1fr; font-size: 13px; }
      .row span:nth-child(3), .row span:nth-child(4), .row span:nth-child(6) { display: none; }
      .row.head { display: none; }
      dl { grid-template-columns: 1fr; }
    }
    .category-list { display: grid; gap: var(--space-2); margin-bottom: var(--space-4); }
    .category-row {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--line-soft); border-radius: var(--radius-sm);
    }
    .category-name { font-weight: 600; flex: 1; }
    .category-edit-input { flex: 1; }
    .category-add { display: flex; gap: var(--space-2); align-items: center; }
    .category-add input { flex: 1; }
    .muted { color: var(--muted); font-size: 13px; }
  `]
})
export class InventoryComponent {
  private readonly api = inject(ApiService);
  private readonly tenants = inject(TenantStore);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly items = signal<InventoryItem[]>([]);
  readonly categories = signal<InventoryCategory[]>([]);
  readonly transactions = signal<InventoryTransaction[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly vehicles = signal<Vehicle[]>([]);
  readonly selected = signal<InventoryItem | null>(null);
  readonly assigning = signal<InventoryItem | null>(null);
  readonly showCreate = signal(false);
  readonly showEdit = signal(false);
  readonly showCategories = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly savingCategory = signal(false);
  readonly deleting = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly categoryFilter = signal<string>('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly stats = signal<InventoryListStats>({ totalItems: 0, availableUnits: 0, assignedUnits: 0, lowStockCount: 0 });
  readonly editingCategoryId = signal<string | null>(null);
  readonly editingCategoryName = signal('');
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  private readonly search$ = new Subject<string>();
  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['']
  });
  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['QUANTITY', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit: ['db'],
    location: [''],
    categoryId: [''],
    lowStockThreshold: [5, [Validators.min(0)]],
    description: [''],
    serialNumber: [''],
    notes: ['']
  });
  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['QUANTITY', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0)]],
    unit: ['db'],
    location: [''],
    categoryId: [''],
    lowStockThreshold: [5, [Validators.min(0)]],
    description: [''],
    serialNumber: [''],
    status: ['AVAILABLE' as InventoryItem['status'], Validators.required],
    notes: ['']
  });
  readonly assignForm = this.fb.nonNullable.group({
    targetType: ['EMPLOYEE', Validators.required],
    targetId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      this.categoryFilter();
      this.pageSize();
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(1);
        untracked(() => this.load());
      });

    this.assignForm.controls.targetType.valueChanges.subscribe(() => {
      this.assignForm.controls.targetId.setValue('');
    });
  }

  onSearchInput(value: string) {
    this.search.set(value);
    this.search$.next(value);
  }

  changePageSize(value: string) {
    const size = Number.parseInt(value, 10);
    if (!Number.isFinite(size)) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.state.set('loading');
    const params = new URLSearchParams();
    params.set('page', String(this.page()));
    params.set('pageSize', String(this.pageSize()));
    const search = this.search().trim();
    if (search) params.set('search', search);
    const categoryId = this.categoryFilter();
    if (categoryId) params.set('categoryId', categoryId);
    this.api.get<PaginatedInventory>(`/inventory/items?${params.toString()}`).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.stats.set(result.stats);
        if (result.totalPages > 0 && this.page() > result.totalPages) {
          this.page.set(result.totalPages);
        }
        this.loading.set(false);
        this.state.set('ready');
      },
      error: () => {
        this.loading.set(false);
        this.state.set('error');
      }
    });
    this.api.get<Employee[]>('/employees').subscribe({ next: (employees) => this.employees.set(employees) });
    this.api.get<Vehicle[]>('/vehicles').subscribe({ next: (vehicles) => this.vehicles.set(vehicles) });
    this.api.get<InventoryCategory[]>('/inventory-categories').subscribe({ next: (categories) => this.categories.set(categories) });
  }

  categoryName(categoryId?: string) {
    if (!categoryId) return '-';
    return this.categories().find((category) => category._id === categoryId)?.name ?? '-';
  }

  openCreate() {
    this.createForm.reset({ name: '', type: 'QUANTITY', quantity: 1, unit: 'db', location: '', categoryId: '', lowStockThreshold: 5, description: '', serialNumber: '', notes: '' });
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  create() {
    if (this.createForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post<InventoryItem>('/inventory/items', this.createForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.toasts.success('Inventory item saved.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not save inventory item.');
      }
    });
  }

  printItem(item: InventoryItem) {
    printLabel({
      number: item.inventoryNumber,
      title: item.type === 'ASSET' ? 'Asset' : 'Inventory',
      subtitle: item.name,
      meta: [
        { label: 'Category', value: item.categoryId ?? '-' },
        { label: 'Type', value: item.type },
        { label: 'Quantity', value: String(item.quantity) }
      ]
    });
  }

  openEdit(item: InventoryItem) {
    this.api.get<InventoryItem>(`/inventory/items/${item._id}`).subscribe({
      next: (fresh) => {
        this.selected.set(fresh);
        this.transactions.set([]);
        this.api.get<InventoryTransaction[]>(`/inventory/transactions?itemId=${fresh._id}`).subscribe({
          next: (transactions) => this.transactions.set(transactions)
        });
        this.editForm.reset({
          name: fresh.name,
          type: fresh.type,
          quantity: fresh.quantity,
          unit: (fresh as InventoryItem & { unit?: string }).unit ?? 'db',
          location: fresh.location ?? '',
          categoryId: fresh.categoryId ?? '',
          lowStockThreshold: (fresh as InventoryItem & { lowStockThreshold?: number }).lowStockThreshold ?? 5,
          description: fresh.description ?? '',
          serialNumber: fresh.serialNumber ?? '',
          status: fresh.status,
          notes: fresh.notes ?? ''
        });
        this.showEdit.set(true);
      }
    });
  }

  closeEdit() {
    this.showEdit.set(false);
    this.selected.set(null);
    this.transactions.set([]);
  }

  select(item: InventoryItem) {
    this.openEdit(item);
  }

  update(id: string) {
    if (this.editForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.patch<InventoryItem>(`/inventory/items/${id}`, this.editForm.getRawValue()).subscribe({
      next: (item) => {
        this.saving.set(false);
        this.selected.set(item);
        this.toasts.success('Inventory item updated.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not update inventory item.');
      }
    });
  }

  async remove(id: string) {
    const ok = await this.confirm.confirm({
      title: 'Delete inventory item?',
      message: 'This will permanently remove the item and its assignment history. This action cannot be undone.',
      confirmLabel: 'Delete item',
      danger: true,
      icon: 'Trash2'
    });
    if (!ok) return;
    this.deleting.set(true);
    this.confirm.setLoading(true);
    this.api.delete<InventoryItem>(`/inventory/items/${id}`).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.closeEdit();
        this.toasts.success('Inventory item deleted.');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.confirm.setLoading(false);
        this.toasts.error('Could not delete inventory item.');
      }
    });
  }

  startAssign(item: InventoryItem) {
    this.assigning.set(item);
    this.assignForm.patchValue({ quantity: 1, targetType: 'EMPLOYEE', targetId: '' });
  }

  closeAssign() {
    this.assigning.set(null);
  }

  assign() {
    const item = this.assigning();
    if (!item || this.assignForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.post('/assignments/inventory', { itemId: item._id, ...this.assignForm.getRawValue() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.assigning.set(null);
        this.toasts.success('Inventory assigned.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Inventory assignment failed.');
      }
    });
  }

  // --- Category management ---

  openCategories() {
    this.showCategories.set(true);
  }

  closeCategories() {
    this.showCategories.set(false);
    this.cancelCategoryEdit();
    this.categoryForm.reset({ name: '', code: '' });
  }

  createCategory() {
    if (this.categoryForm.invalid || this.savingCategory()) return;
    this.savingCategory.set(true);
    this.api.post<InventoryCategory>('/inventory-categories', this.categoryForm.getRawValue()).subscribe({
      next: (category) => {
        this.savingCategory.set(false);
        this.categories.update((list) => [...list, category]);
        this.categoryForm.reset({ name: '', code: '' });
        this.toasts.success('Category created.');
      },
      error: () => {
        this.savingCategory.set(false);
        this.toasts.error('Could not create category.');
      }
    });
  }

  startCategoryEdit(category: InventoryCategory) {
    this.editingCategoryId.set(category._id);
    this.editingCategoryName.set(category.name);
  }

  cancelCategoryEdit() {
    this.editingCategoryId.set(null);
    this.editingCategoryName.set('');
  }

  saveCategoryEdit(id: string) {
    const name = this.editingCategoryName().trim();
    if (!name) return;
    this.api.patch<InventoryCategory>(`/inventory-categories/${id}`, { name }).subscribe({
      next: (updated) => {
        this.categories.update((list) => list.map((c) => (c._id === id ? updated : c)));
        this.cancelCategoryEdit();
        this.toasts.success('Category updated.');
      },
      error: () => {
        this.toasts.error('Could not update category.');
      }
    });
  }

  async deleteCategory(category: InventoryCategory) {
    const confirmed = await this.confirm.confirm({
      title: 'Delete category?',
      message: `Are you sure you want to delete "${category.name}"? Items in this category will be uncategorized.`,
      confirmLabel: 'Delete',
      danger: true,
      icon: 'Trash2'
    });
    if (!confirmed) return;
    this.api.delete(`/inventory-categories/${category._id}`).subscribe({
      next: () => {
        this.categories.update((list) => list.filter((c) => c._id !== category._id));
        this.toasts.success('Category deleted.');
      },
      error: () => {
        this.toasts.error('Could not delete category.');
      }
    });
  }
}
