import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ContextMenuComponent, ContextMenuItem } from '../../shared/ui/context-menu.component';
import { EmptyStateComponent } from '../../shared/ui/feedback.component';
import { IconDirective, type AppIconName } from '../../shared/ui/icon.directive';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ToastService } from '../../shared/ui/toast.service';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { DocumentBlobCache } from './document-blob.cache';
import { DocumentFolder, DocumentKind, DocumentsApi, StoredDocument } from './documents.api';

type LoadState = 'loading' | 'ready' | 'error';
type MenuTarget = { type: 'document'; document: StoredDocument } | { type: 'folder'; folder: DocumentFolder };

interface TreeRow {
  folder: DocumentFolder;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

const ROOT = 'root';

const KIND_LABELS: Record<DocumentKind, string> = {
  image: 'Kép',
  pdf: 'PDF',
  word: 'Dokumentum',
  sheet: 'Táblázat',
  text: 'Szöveg',
  other: 'Egyéb'
};

const KIND_ICONS: Record<DocumentKind, AppIconName> = {
  image: 'FileImage',
  pdf: 'FileText',
  word: 'FileText',
  sheet: 'FileSpreadsheet',
  text: 'FileText',
  other: 'File'
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    IconDirective,
    TooltipDirective,
    ReactiveFormsModule,
    ModalComponent,
    EmptyStateComponent,
    ContextMenuComponent
  ],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Dokumentumok</h1>
          <p>{{ total() }} dokumentum · {{ folders().length }} mappa · jobb klikk a műveletekhez</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost" type="button" [class.btn--loading]="loading()" (click)="load()" appTooltip="Frissítés">
            @if (loading()) { <span class="spinner"></span> } @else { <span appIcon="RefreshCw" [size]="16"></span> }
            Frissítés
          </button>
          @if (canUpdate()) {
            <button class="btn btn--ghost" type="button" (click)="openNewFolder(selectedFolderId())">
              <span appIcon="FolderPlus" [size]="16"></span>Új mappa
            </button>
          }
          @if (canCreate()) {
            <button class="btn btn--secondary" type="button" [class.btn--loading]="uploading() > 0" (click)="filePicker.click()">
              @if (uploading() > 0) { <span class="spinner"></span> } @else { <span appIcon="Upload" [size]="16"></span> }
              Feltöltés
            </button>
          }
        </div>
      </div>

      <input
        #filePicker
        class="hidden-input"
        type="file"
        multiple
        [accept]="acceptAttribute"
        (change)="onFilesPicked($event)"
      />

      <div class="docs-layout">
        <aside class="docs-tree card card--flush">
          <div class="tree-head">
            <h2>Mappák</h2>
            @if (canUpdate()) {
              <button class="btn--icon btn--subtle btn--sm" type="button" appTooltip="Új mappa a gyökérben" (click)="openNewFolder('root')">
                <span appIcon="FolderPlus" [size]="16"></span>
              </button>
            }
          </div>
          <div class="tree-body">
            <button
              class="tree-row"
              type="button"
              [class.active]="selectedFolderId() === 'root'"
              [class.drop-target]="dropFolderId() === 'root'"
              (click)="selectFolder('root')"
              (dragover)="onFolderDragOver($event, 'root')"
              (dragleave)="onFolderDragLeave('root')"
              (drop)="onFolderDrop($event, 'root')"
            >
              <span class="tree-spacer"></span>
              <span class="tree-icon" appIcon="Inbox" [size]="16"></span>
              <span class="tree-label">Gyökér</span>
              <small class="tree-count">{{ rootCount() }}</small>
            </button>

            @for (row of treeRows(); track row.folder._id) {
              <div
                class="tree-row"
                [class.active]="selectedFolderId() === row.folder._id"
                [class.drop-target]="dropFolderId() === row.folder._id"
                [style.padding-left.px]="10 + row.depth * 14"
                (click)="selectFolder(row.folder._id)"
                (contextmenu)="openFolderMenu($event, row.folder)"
                (dragover)="onFolderDragOver($event, row.folder._id)"
                (dragleave)="onFolderDragLeave(row.folder._id)"
                (drop)="onFolderDrop($event, row.folder._id)"
              >
                @if (row.hasChildren) {
                  <button
                    class="tree-toggle"
                    type="button"
                    [attr.aria-label]="row.expanded ? 'Összecsukás' : 'Kibontás'"
                    (click)="toggleFolder($event, row.folder._id)"
                  >
                    <span [appIcon]="row.expanded ? 'ChevronDown' : 'ChevronRight'" [size]="14"></span>
                  </button>
                } @else {
                  <span class="tree-spacer"></span>
                }
                <span class="tree-icon" [appIcon]="row.expanded ? 'FolderOpen' : 'Folder'" [size]="16"></span>
                <span class="tree-label">{{ row.folder.name }}</span>
                <small class="tree-count">{{ row.folder.documentCount }}</small>
              </div>
            }

            @if (folders().length === 0) {
              <p class="tree-empty">Még nincs mappa. Rendszerezd a dokumentumokat mappákba.</p>
            }
          </div>
        </aside>

        <div
          class="docs-main"
          [class.is-dragging]="dragActive()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          <div class="filter-bar">
            <label class="field search-field">
              <span class="field-label">Keresés</span>
              <span class="input-affix">
                <span class="affix-icon" appIcon="Search" [size]="16"></span>
                <input
                  type="text"
                  [value]="search()"
                  (input)="onSearchInput($any($event.target).value)"
                  placeholder="Név, címke vagy felismert szöveg…"
                />
              </span>
            </label>
            <label class="field filter-field">
              <span class="field-label">Típus</span>
              <select [value]="kindFilter()" (change)="kindFilter.set($any($event.target).value)">
                <option value="">Minden típus</option>
                @for (kind of kindOptions; track kind.value) {
                  <option [value]="kind.value">{{ kind.label }}</option>
                }
              </select>
            </label>
            <label class="field filter-field">
              <span class="field-label">Címke</span>
              <select [value]="tagFilter()" (change)="tagFilter.set($any($event.target).value)">
                <option value="">Minden címke</option>
                @for (tag of tags(); track tag) {
                  <option [value]="tag">{{ tag }}</option>
                }
              </select>
            </label>
            <label class="field page-size-field">
              <span class="field-label">Oldalanként</span>
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
              <div class="breadcrumb">
                <span appIcon="Inbox" [size]="14"></span>
                @if (searching()) {
                  <span class="crumb">Keresés minden mappában</span>
                } @else {
                  @for (crumb of breadcrumb(); track crumb.id) {
                    <span appIcon="ChevronRight" [size]="13" class="crumb-sep"></span>
                    <button class="crumb" type="button" (click)="selectFolder(crumb.id)">{{ crumb.name }}</button>
                  }
                }
              </div>
              <span class="table-meta">{{ total() }} db</span>
            </div>

            <div class="table-scroll">
              @if (state() === 'loading') {
                <div class="skeleton-list">
                  @for (i of skeletons; track i) {
                    <div class="skeleton-row">
                      <span class="skeleton skeleton--line" style="width: 34%"></span>
                      <span class="skeleton skeleton--line" style="width: 16%"></span>
                      <span class="skeleton skeleton--line" style="width: 12%"></span>
                      <span class="skeleton skeleton--line" style="width: 14%"></span>
                    </div>
                  }
                </div>
              } @else if (state() === 'error') {
                <div class="state-card is-error">
                  <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
                  <h3>Nem sikerült betölteni</h3>
                  <p>Valami hiba történt a dokumentumok lekérésekor. Próbáld újra.</p>
                  <button class="btn btn--ghost" type="button" (click)="load()">
                    <span appIcon="RefreshCw" [size]="16"></span>Újra
                  </button>
                </div>
              } @else if (documents().length === 0 && childFolders().length === 0 && !parentFolder()) {
                <app-empty-state
                  icon="Archive"
                  title="Nincs itt dokumentum"
                  [description]="
                    searching()
                      ? 'Nincs találat a keresésre. Próbálj más kulcsszót.'
                      : 'Húzd ide a fájlokat, vagy töltsd fel a Feltöltés gombbal. PDF, kép és Word dokumentum támogatott.'
                  "
                >
                  @if (!searching() && canCreate()) {
                    <button class="btn btn--secondary" type="button" (click)="filePicker.click()">
                      <span appIcon="Upload" [size]="16"></span>Feltöltés
                    </button>
                  }
                </app-empty-state>
              } @else {
                <div class="row head">
                  <span></span><span>Név</span><span>Típus</span><span>Méret</span><span>Feltöltötte</span><span>Dátum</span><span></span>
                </div>

                @if (!searching()) {
                  @if (parentFolder(); as parent) {
                    <div
                      class="row row--folder row--up"
                      [class.drop-target]="dropFolderId() === parent.id"
                      (click)="selectFolder(parent.id)"
                      (dragover)="onFolderDragOver($event, parent.id)"
                      (dragleave)="onFolderDragLeave(parent.id)"
                      (drop)="onFolderDrop($event, parent.id)"
                    >
                      <span class="doc-thumb doc-thumb--folder">
                        <span appIcon="CornerLeftUp" [size]="18"></span>
                      </span>
                      <span class="doc-name">
                        <strong>Vissza: {{ parent.name }}</strong>
                        <small class="col-muted">Egy szinttel feljebb</small>
                      </span>
                      <span></span><span></span><span></span><span></span><span></span>
                    </div>
                  }

                  @for (folder of childFolders(); track folder._id) {
                    <div
                      class="row row--folder"
                      [class.drop-target]="dropFolderId() === folder._id"
                      [class.selected]="menuFolderId() === folder._id"
                      (click)="selectFolder(folder._id)"
                      (contextmenu)="openFolderMenu($event, folder)"
                      (dragover)="onFolderDragOver($event, folder._id)"
                      (dragleave)="onFolderDragLeave(folder._id)"
                      (drop)="onFolderDrop($event, folder._id)"
                    >
                      <span class="doc-thumb doc-thumb--folder">
                        <span appIcon="Folder" [size]="18"></span>
                      </span>
                      <span class="doc-name">
                        <strong class="truncate" [title]="folder.name">{{ folder.name }}</strong>
                        @if (subfolderCount(folder._id) > 0) {
                          <small class="col-muted">{{ subfolderCount(folder._id) }} almappa</small>
                        }
                      </span>
                      <span class="badge badge--muted">Mappa</span>
                      <span class="col-muted">—</span>
                      <span class="col-muted">{{ folder.documentCount }} dokumentum</span>
                      <span class="col-muted">{{ formatDate(folder.createdAt) }}</span>
                      <span class="row-actions">
                        <button
                          class="btn--icon btn--subtle btn--sm"
                          type="button"
                          appTooltip="Műveletek"
                          (click)="openFolderMenu($event, folder)"
                        >
                          <span appIcon="EllipsisVertical" [size]="16"></span>
                        </button>
                      </span>
                    </div>
                  }

                  @if (documents().length === 0) {
                    <p class="folder-note">Ebben a mappában nincs dokumentum.</p>
                  }
                }
                @for (document of documents(); track document._id) {
                  <div
                    class="row"
                    [class.selected]="menuTarget()?.type === 'document' && menuDocumentId() === document._id"
                    (dblclick)="openPreview(document)"
                    (contextmenu)="openDocumentMenu($event, document)"
                  >
                    <span class="doc-thumb">
                      @if (thumbnails().get(document._id); as thumb) {
                        <img [src]="thumb" [alt]="document.name" />
                      } @else {
                        <span class="doc-thumb-icon" [appIcon]="iconFor(document)" [size]="18"></span>
                      }
                    </span>
                    <span class="doc-name">
                      <strong class="truncate" [title]="document.name">{{ document.name }}</strong>
                      @if (document.tags.length > 0) {
                        <span class="doc-tags">
                          @for (tag of document.tags; track tag) {
                            <small class="badge badge--muted">{{ tag }}</small>
                          }
                        </span>
                      }
                    </span>
                    <span class="badge" [class.badge--info]="document.kind === 'image'" [class.badge--muted]="document.kind !== 'image'">
                      {{ kindLabel(document.kind) }}
                    </span>
                    <span class="col-muted size-cell">
                      {{ formatBytes(document.size) }}
                      @if (document.originalSize) {
                        <small appTooltip="Eredeti méret: {{ formatBytes(document.originalSize) }}">
                          −{{ savedPercent(document) }}%
                        </small>
                      }
                    </span>
                    <span class="col-muted truncate">{{ document.uploadedByName }}</span>
                    <span class="col-muted">{{ formatDate(document.createdAt) }}</span>
                    <span class="row-actions">
                      <button
                        class="btn--icon btn--subtle btn--sm"
                        type="button"
                        appTooltip="Előnézet"
                        (click)="openPreview(document)"
                      >
                        <span appIcon="Eye" [size]="16"></span>
                      </button>
                      <button
                        class="btn--icon btn--subtle btn--sm"
                        type="button"
                        appTooltip="Műveletek"
                        (click)="openDocumentMenu($event, document)"
                      >
                        <span appIcon="EllipsisVertical" [size]="16"></span>
                      </button>
                    </span>
                  </div>
                }
              }
            </div>

            @if (totalPages() > 1) {
              <div class="pagination">
                <button class="btn btn--ghost btn--sm" type="button" [disabled]="page() === 1 || loading()" (click)="goToPage(page() - 1)">
                  <span appIcon="ChevronLeft" [size]="16"></span> Előző
                </button>
                <span class="pagination-info">{{ page() }} / {{ totalPages() }} oldal</span>
                <button class="btn btn--ghost btn--sm" type="button" [disabled]="page() >= totalPages() || loading()" (click)="goToPage(page() + 1)">
                  Következő <span appIcon="ChevronRight" [size]="16"></span>
                </button>
              </div>
            }
          </div>

          @if (dragActive()) {
            <div class="dropzone-overlay">
              <span appIcon="CloudUpload" [size]="30"></span>
              <strong>Engedd el a feltöltéshez</strong>
              <small>Ide kerül: {{ currentFolderName() }}</small>
            </div>
          }
        </div>
      </div>

      @if (menuTarget(); as target) {
        <app-context-menu
          [x]="menuX()"
          [y]="menuY()"
          [heading]="target.type === 'document' ? target.document.name : target.folder.name"
          [items]="menuItems()"
          (select)="runMenuAction($event)"
          (close)="closeMenu()"
        />
      }

      <!-- Preview -->
      @if (preview(); as item) {
        <app-modal
          [title]="item.document.name"
          [description]="previewSubtitle(item.document)"
          size="lg"
          (close)="closePreview()"
        >
          <div class="preview-body">
            @if (item.loading) {
              <div class="preview-loading"><span class="spinner spinner--lg"></span></div>
            } @else if (item.error) {
              <div class="state-card is-error">
                <span class="state-icon" appIcon="TriangleAlert" [size]="22"></span>
                <h3>Nem sikerült megnyitni</h3>
                <p>{{ item.error }}</p>
              </div>
            } @else if (item.document.kind === 'image' && item.url) {
              <div
                class="image-viewport"
                [class.is-zoomed]="zoom() > 1"
                [class.is-panning]="panning()"
                [class.is-smooth]="smoothZoom()"
                (wheel)="onZoomWheel($event)"
                (pointerdown)="onPanStart($event)"
                (pointermove)="onPanMove($event)"
                (pointerup)="onPanEnd($event)"
                (pointercancel)="onPanEnd($event)"
                (dblclick)="toggleZoom($event)"
              >
                <img
                  #previewImage
                  class="preview-image"
                  [src]="item.url"
                  [alt]="item.document.name"
                  [style.transform]="imageTransform()"
                  draggable="false"
                />
                <div class="zoom-bar" (pointerdown)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                  <button
                    class="btn--icon btn--subtle btn--sm"
                    type="button"
                    appTooltip="Kicsinyítés"
                    [disabled]="zoom() <= minZoom"
                    (click)="zoomBy(1 / zoomStep)"
                  >
                    <span appIcon="ZoomOut" [size]="16"></span>
                  </button>
                  <button class="zoom-level" type="button" appTooltip="Eredeti nézet" (click)="resetZoom()">
                    {{ zoomPercent() }}%
                  </button>
                  <button
                    class="btn--icon btn--subtle btn--sm"
                    type="button"
                    appTooltip="Nagyítás"
                    [disabled]="zoom() >= maxZoom"
                    (click)="zoomBy(zoomStep)"
                  >
                    <span appIcon="ZoomIn" [size]="16"></span>
                  </button>
                </div>
                @if (zoom() === 1) {
                  <small class="zoom-hint">Görgetéssel vagy dupla kattintással nagyíthatsz</small>
                }
              </div>
            } @else if (item.document.kind === 'pdf' && item.safeUrl) {
              <iframe class="preview-frame" [src]="item.safeUrl" [title]="item.document.name"></iframe>
            } @else if (item.document.kind === 'text' && item.text !== undefined) {
              <pre class="preview-text">{{ item.text }}</pre>
            } @else {
              <div class="preview-fallback">
                <span class="preview-fallback-icon" [appIcon]="iconFor(item.document)" [size]="34"></span>
                <h3>Ez a fájltípus nem néz ki jól a böngészőben</h3>
                <p>Töltsd le, és nyisd meg a saját alkalmazásoddal.</p>
                <button class="btn btn--secondary" type="button" (click)="download(item.document)">
                  <span appIcon="Download" [size]="16"></span>Letöltés
                </button>
              </div>
            }

            @if (item.document.notes) {
              <p class="preview-notes">{{ item.document.notes }}</p>
            }
          </div>

          <div class="modal-foot modal-foot--between" slot="footer">
            <div class="cluster">
              @if (item.document.kind === 'image') {
                <button class="btn btn--ghost" type="button" [class.btn--loading]="ocrRunning()" (click)="runOcr(item.document)">
                  @if (ocrRunning()) { <span class="spinner"></span> } @else { <span appIcon="ScanText" [size]="16"></span> }
                  Szöveg kinyerése
                </button>
                <button class="btn btn--ghost" type="button" (click)="copyImageToClipboard(item.document)">
                  <span appIcon="Copy" [size]="16"></span>Kép másolása
                </button>
              }
            </div>
            <div class="cluster">
              <button class="btn btn--ghost" type="button" (click)="download(item.document)">
                <span appIcon="Download" [size]="16"></span>Letöltés
              </button>
              <button class="btn btn--secondary" type="button" (click)="closePreview()">Bezárás</button>
            </div>
          </div>
        </app-modal>
      }

      <!-- Recognised text -->
      @if (ocrPanel(); as panel) {
        <app-modal
          title="Felismert szöveg"
          [description]="panel.documentName"
          size="lg"
          (close)="ocrPanel.set(null)"
        >
          @if (panel.text.length === 0) {
            <div class="alert alert--warn">
              <span class="alert-icon" appIcon="TriangleAlert" [size]="18"></span>
              <div class="alert-body">
                <strong>Nem találtunk olvasható szöveget</strong>
                <p>Próbáld újra egy élesebb vagy nagyobb felbontású fotóval.</p>
              </div>
            </div>
          } @else {
            <textarea class="ocr-text" rows="16" readonly [value]="panel.text"></textarea>
          }
          <div class="modal-foot modal-foot--between" slot="footer">
            <button class="btn btn--ghost" type="button" [class.btn--loading]="ocrRunning()" (click)="rerunOcr(panel.documentId)">
              @if (ocrRunning()) { <span class="spinner"></span> } @else { <span appIcon="RotateCcw" [size]="16"></span> }
              Felismerés újra
            </button>
            <div class="cluster">
              <button class="btn btn--ghost" type="button" (click)="ocrPanel.set(null)">Bezárás</button>
              <button class="btn btn--secondary" type="button" [disabled]="panel.text.length === 0" (click)="copyText(panel.text)">
                <span appIcon="Copy" [size]="16"></span>Másolás
              </button>
            </div>
          </div>
        </app-modal>
      }

      <!-- Rename -->
      @if (renameTarget(); as target) {
        <app-modal [title]="target.kind === 'folder' ? 'Mappa átnevezése' : 'Dokumentum átnevezése'" size="sm" (close)="renameTarget.set(null)">
          <form class="modal-form" [formGroup]="renameForm" (ngSubmit)="submitRename()">
            <label class="field">
              <span class="field-label">Név <span class="req">*</span></span>
              <input formControlName="name" autofocus />
            </label>
            <div class="modal-foot">
              <button class="btn btn--ghost" type="button" (click)="renameTarget.set(null)">Mégse</button>
              <button class="btn btn--secondary" type="submit" [disabled]="renameForm.invalid || saving()">Mentés</button>
            </div>
          </form>
        </app-modal>
      }

      <!-- New folder -->
      @if (newFolderParent() !== null) {
        <app-modal title="Új mappa" [description]="'Szülő: ' + folderName(newFolderParent())" size="sm" (close)="newFolderParent.set(null)">
          <form class="modal-form" [formGroup]="folderForm" (ngSubmit)="submitNewFolder()">
            <label class="field">
              <span class="field-label">Mappa neve <span class="req">*</span></span>
              <input formControlName="name" autofocus placeholder="pl. Szállítólevelek" />
            </label>
            <div class="modal-foot">
              <button class="btn btn--ghost" type="button" (click)="newFolderParent.set(null)">Mégse</button>
              <button class="btn btn--secondary" type="submit" [disabled]="folderForm.invalid || saving()">Létrehozás</button>
            </div>
          </form>
        </app-modal>
      }

      <!-- Move / copy to folder -->
      @if (moveTarget(); as target) {
        <app-modal
          [title]="target.mode === 'copy' ? 'Másolás mappába' : 'Áthelyezés'"
          [description]="target.name"
          size="sm"
          (close)="moveTarget.set(null)"
        >
          <label class="field">
            <span class="field-label">Célmappa</span>
            <select [value]="moveDestination()" (change)="moveDestination.set($any($event.target).value)">
              <option value="root">Gyökér</option>
              @for (option of folderOptions(); track option.id) {
                <option [value]="option.id" [disabled]="target.disabledIds.includes(option.id)">{{ option.label }}</option>
              }
            </select>
          </label>
          <div class="modal-foot">
            <button class="btn btn--ghost" type="button" (click)="moveTarget.set(null)">Mégse</button>
            <button class="btn btn--secondary" type="button" [disabled]="saving()" (click)="submitMove()">
              {{ target.mode === 'copy' ? 'Másolás' : 'Áthelyezés' }}
            </button>
          </div>
        </app-modal>
      }

      <!-- Tags -->
      @if (tagTarget(); as target) {
        <app-modal title="Címkék" [description]="target.name" size="sm" (close)="tagTarget.set(null)">
          <form class="modal-form" [formGroup]="tagForm" (ngSubmit)="submitTags()">
            <label class="field">
              <span class="field-label">Címkék <small class="field-hint">vesszővel elválasztva</small></span>
              <input formControlName="tags" placeholder="pl. számla, 2026, beszállító" />
            </label>
            <label class="field">
              <span class="field-label">Megjegyzés</span>
              <textarea formControlName="notes" rows="3"></textarea>
            </label>
            <div class="modal-foot">
              <button class="btn btn--ghost" type="button" (click)="tagTarget.set(null)">Mégse</button>
              <button class="btn btn--secondary" type="submit" [disabled]="saving()">Mentés</button>
            </div>
          </form>
        </app-modal>
      }
    </section>
  `,
  styles: [
    `
      .hidden-input { display: none; }

      .docs-layout {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
      }

      @media (max-width: 900px) {
        .docs-layout { grid-template-columns: minmax(0, 1fr); }
      }

      .docs-tree { position: sticky; top: var(--space-4); overflow: hidden; }
      .docs-tree:hover { border-color: var(--line); }
      .tree-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line-soft);
      }
      .tree-head h2 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
      .tree-body { padding: var(--space-2); display: grid; gap: 1px; max-height: 60vh; overflow: auto; }
      .tree-empty { margin: var(--space-3); color: var(--muted); font-size: 12px; line-height: 1.5; }

      .tree-row {
        display: grid; grid-template-columns: 16px 18px minmax(0, 1fr) auto;
        align-items: center; gap: var(--space-2);
        width: 100%; padding: 6px 10px; border: 0; border-radius: var(--radius-xs);
        background: transparent; color: var(--ink); font: inherit; font-size: 13px;
        text-align: left; cursor: pointer;
        transition: background var(--dur-fast) var(--ease);
      }
      .tree-row:hover { background: var(--surface-hover); }
      .tree-row.active { background: var(--brand-soft); color: var(--brand-ink); font-weight: 600; }
      .tree-row.drop-target { background: var(--brand-soft); box-shadow: inset 0 0 0 1px var(--brand); }
      .tree-toggle {
        display: inline-flex; align-items: center; justify-content: center;
        width: 16px; height: 16px; padding: 0; border: 0; border-radius: 4px;
        background: transparent; color: var(--muted); cursor: pointer;
      }
      .tree-toggle:hover { background: var(--surface-hover); color: var(--ink); }
      .tree-spacer { width: 16px; }
      .tree-icon { display: inline-flex; color: var(--muted); }
      .tree-row.active .tree-icon { color: var(--brand-ink); }
      .tree-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tree-count { color: var(--muted-soft); font-size: 11px; font-variant-numeric: tabular-nums; }

      .docs-main { position: relative; display: grid; gap: var(--space-4); }
      .docs-main.is-dragging { outline: 2px dashed var(--brand); outline-offset: 6px; border-radius: var(--radius-lg); }

      .dropzone-overlay {
        position: absolute; inset: 0; z-index: 5;
        display: grid; place-content: center; justify-items: center; gap: var(--space-2);
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        border-radius: var(--radius-lg); color: var(--brand-ink); pointer-events: none;
      }
      .dropzone-overlay small { color: var(--muted); }

      .filter-bar { display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; }
      .search-field { flex: 1; min-width: 220px; }
      .search-field .input-affix { display: flex; align-items: center; width: 100%; }
      .filter-field { min-width: 170px; }
      .page-size-field { min-width: 110px; }
      .filter-bar .field-label { display: block; }

      .breadcrumb { display: flex; align-items: center; gap: 6px; color: var(--muted); min-width: 0; }
      .crumb {
        border: 0; background: transparent; padding: 0; font: inherit; font-size: 13px;
        color: var(--ink); cursor: pointer; white-space: nowrap;
      }
      .crumb:hover { color: var(--brand-ink); }
      .crumb-sep { display: inline-flex; color: var(--faint); }

      .pagination {
        display: flex; align-items: center; justify-content: center; gap: var(--space-4);
        padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line-soft);
      }
      .pagination-info { color: var(--muted); font-size: 13px; }

      .row {
        display: grid; grid-template-columns: 44px minmax(0, 2fr) 110px 90px 1fr 130px 80px;
        gap: var(--space-3); padding: var(--space-3) var(--space-5);
        border-top: 1px solid var(--line-soft); align-items: center;
      }
      .row:first-child { border-top: 0; }
      .row:not(.head) { cursor: context-menu; transition: background var(--dur-fast) var(--ease); }
      .row:not(.head):hover { background: var(--surface-hover); }
      .row.selected { background: var(--brand-soft); }
      .row.head { color: var(--muted); background: var(--surface-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
      .row-actions { display: flex; gap: 4px; justify-content: flex-end; }

      .doc-thumb {
        display: grid; place-items: center; width: 36px; height: 36px;
        border-radius: var(--radius-xs); background: var(--surface-soft);
        border: 1px solid var(--line-soft); overflow: hidden;
      }
      .doc-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .doc-thumb-icon { color: var(--muted); display: inline-flex; }

      .row--folder { cursor: pointer; }
      .row--folder .doc-thumb { background: transparent; border-style: dashed; }
      .row--folder .doc-thumb-icon,
      .row--folder .doc-thumb > span { color: var(--brand-ink); }
      .row--up .doc-thumb > span { color: var(--muted); }
      .row--up strong { color: var(--muted); font-weight: 500; }
      .row.drop-target { background: var(--brand-soft); box-shadow: inset 0 0 0 1px var(--brand); }
      .folder-note {
        margin: 0;
        padding: var(--space-4) var(--space-5);
        border-top: 1px solid var(--line-soft);
        color: var(--muted);
        font-size: 13px;
      }

      .doc-name { display: grid; gap: 3px; min-width: 0; }
      .size-cell { display: grid; gap: 1px; }
      .size-cell small { color: var(--success); font-size: 11px; }
      .doc-tags { display: flex; gap: 4px; flex-wrap: wrap; }

      .preview-body { display: grid; gap: var(--space-3); }
      .preview-loading { display: grid; place-items: center; min-height: 240px; }
      .image-viewport {
        position: relative;
        /* Flex, not grid: a percentage max-height only resolves against a
           definite container height, which an auto grid row is not. */
        display: flex;
        align-items: center;
        justify-content: center;
        height: 62vh;
        overflow: hidden;
        border-radius: var(--radius);
        background: var(--surface-soft);
        /* Only swallow touch gestures once there is something to pan; at fit
           size the page must still scroll normally on a tablet. */
        touch-action: pan-y;
      }
      .image-viewport.is-zoomed { cursor: grab; touch-action: none; }
      .image-viewport.is-panning { cursor: grabbing; }
      .preview-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transform-origin: center center;
        will-change: transform;
        user-select: none;
        -webkit-user-drag: none;
      }
      .image-viewport.is-smooth .preview-image { transition: transform var(--dur) var(--ease-out); }

      .zoom-bar {
        position: absolute;
        right: var(--space-3);
        bottom: var(--space-3);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border: 1px solid var(--line);
        border-radius: var(--radius-pill);
        background: var(--elevated);
        box-shadow: var(--shadow);
      }
      .zoom-level {
        min-width: 54px;
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--ink);
        font: inherit;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .zoom-level:hover { background: var(--surface-hover); }
      .zoom-hint {
        position: absolute;
        left: var(--space-3);
        bottom: var(--space-3);
        padding: 4px var(--space-3);
        border-radius: var(--radius-pill);
        background: var(--elevated);
        border: 1px solid var(--line);
        color: var(--muted);
        font-size: 11px;
        pointer-events: none;
      }
      .preview-frame { width: 100%; height: 62vh; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-soft); }
      .preview-text {
        margin: 0; max-height: 58vh; overflow: auto; white-space: pre-wrap; word-break: break-word;
        padding: var(--space-4); border-radius: var(--radius); border: 1px solid var(--line);
        background: var(--surface-soft); font-family: var(--font-mono); font-size: 12px;
      }
      .preview-fallback { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); text-align: center; }
      .preview-fallback-icon { color: var(--muted); }
      .preview-fallback h3 { margin: 0; font-size: 15px; }
      .preview-fallback p { margin: 0; color: var(--muted); font-size: 13px; }
      .preview-notes { margin: 0; color: var(--muted); font-size: 13px; }

      .ocr-text {
        width: 100%; resize: vertical; font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
      }

      .modal-form { display: grid; gap: var(--space-4); }
    `
  ]
})
export class DocumentsComponent {
  private readonly api = inject(DocumentsApi);
  private readonly blobs = inject(DocumentBlobCache);
  private readonly tenants = inject(TenantStore);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(FormBuilder);

  readonly formatBytes = formatBytes;
  readonly formatDate = formatDate;
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly kindOptions = (Object.keys(KIND_LABELS) as DocumentKind[]).map((value) => ({
    value,
    label: KIND_LABELS[value]
  }));
  readonly acceptAttribute =
    '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.txt,.md';

  readonly documents = signal<StoredDocument[]>([]);
  readonly folders = signal<DocumentFolder[]>([]);
  readonly tags = signal<string[]>([]);
  readonly thumbnails = signal<Map<string, string>>(new Map());

  readonly state = signal<LoadState>('loading');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(0);
  readonly ocrRunning = signal(false);

  readonly selectedFolderId = signal<string>(ROOT);
  readonly expanded = signal<Set<string>>(new Set());
  readonly search = signal('');
  readonly kindFilter = signal('');
  readonly tagFilter = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly total = signal(0);
  readonly totalPages = signal(0);

  readonly dragActive = signal(false);
  readonly dropFolderId = signal<string | null>(null);

  // --- image preview zoom ---
  readonly minZoom = 1;
  readonly maxZoom = 8;
  readonly zoomStep = 1.4;
  readonly zoom = signal(1);
  readonly offset = signal({ x: 0, y: 0 });
  readonly panning = signal(false);
  /** Animate the step zooms, but follow the wheel and the drag instantly. */
  readonly smoothZoom = signal(true);
  private readonly previewImage = viewChild<ElementRef<HTMLImageElement>>('previewImage');
  private panStart: { x: number; y: number; ox: number; oy: number } | null = null;

  readonly menuTarget = signal<MenuTarget | null>(null);
  readonly menuX = signal(0);
  readonly menuY = signal(0);

  readonly preview = signal<{
    document: StoredDocument;
    url?: string;
    safeUrl?: SafeResourceUrl;
    text?: string;
    loading: boolean;
    error?: string;
  } | null>(null);
  readonly ocrPanel = signal<{ documentId: string; documentName: string; text: string } | null>(null);
  readonly renameTarget = signal<{ kind: 'document' | 'folder'; id: string } | null>(null);
  readonly newFolderParent = signal<string | null>(null);
  readonly moveTarget = signal<{
    mode: 'move' | 'copy';
    kind: 'document' | 'folder';
    id: string;
    name: string;
    disabledIds: string[];
  } | null>(null);
  readonly moveDestination = signal<string>(ROOT);
  readonly tagTarget = signal<{ id: string; name: string } | null>(null);

  private readonly search$ = new Subject<string>();

  readonly renameForm = this.fb.nonNullable.group({ name: ['', Validators.required] });
  readonly folderForm = this.fb.nonNullable.group({ name: ['', Validators.required] });
  readonly tagForm = this.fb.nonNullable.group({ tags: [''], notes: [''] });

  readonly searching = computed(() => this.search().trim().length > 0);
  /** The root bucket has no folder record, so its count is tracked separately. */
  readonly rootCount = signal(0);

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  readonly imageTransform = computed(() => {
    const { x, y } = this.offset();
    return `translate(${x}px, ${y}px) scale(${this.zoom()})`;
  });

  readonly menuDocumentId = computed(() => {
    const target = this.menuTarget();
    return target?.type === 'document' ? target.document._id : null;
  });

  readonly menuFolderId = computed(() => {
    const target = this.menuTarget();
    return target?.type === 'folder' ? target.folder._id : null;
  });

  /** Folders directly inside the open one, listed above the documents. */
  readonly childFolders = computed(() => {
    const parentId = this.selectedFolderId() === ROOT ? null : this.selectedFolderId();
    return this.folders()
      .filter((folder) => (folder.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  });

  /** The folder one level up, or null at the root. */
  readonly parentFolder = computed<{ id: string; name: string } | null>(() => {
    const currentId = this.selectedFolderId();
    if (currentId === ROOT) return null;
    const current = this.folders().find((folder) => folder._id === currentId);
    if (!current) return null;
    if (!current.parentId) return { id: ROOT, name: 'Gyökér' };
    const parent = this.folders().find((folder) => folder._id === current.parentId);
    return parent ? { id: parent._id, name: parent.name } : { id: ROOT, name: 'Gyökér' };
  });

  readonly treeRows = computed<TreeRow[]>(() => {
    const byParent = new Map<string, DocumentFolder[]>();
    for (const folder of this.folders()) {
      const key = folder.parentId ?? ROOT;
      byParent.set(key, [...(byParent.get(key) ?? []), folder]);
    }

    const expanded = this.expanded();
    const rows: TreeRow[] = [];
    const walk = (parent: string, depth: number) => {
      for (const folder of byParent.get(parent) ?? []) {
        const hasChildren = (byParent.get(folder._id) ?? []).length > 0;
        const isExpanded = expanded.has(folder._id);
        rows.push({ folder, depth, hasChildren, expanded: isExpanded });
        if (hasChildren && isExpanded) walk(folder._id, depth + 1);
      }
    };
    walk(ROOT, 0);
    return rows;
  });

  /** Flat `Parent / Child` labels for the move dialog. */
  readonly folderOptions = computed(() => {
    const byId = new Map(this.folders().map((folder) => [folder._id, folder]));
    return this.folders()
      .map((folder) => {
        const parts: string[] = [folder.name];
        let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
        let guard = 0;
        while (parent && guard++ < 20) {
          parts.unshift(parent.name);
          parent = parent.parentId ? byId.get(parent.parentId) : undefined;
        }
        return { id: folder._id, label: parts.join(' / ') };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'hu'));
  });

  readonly breadcrumb = computed(() => {
    const byId = new Map(this.folders().map((folder) => [folder._id, folder]));
    const crumbs: { id: string; name: string }[] = [{ id: ROOT, name: 'Gyökér' }];
    const chain: { id: string; name: string }[] = [];
    let current = this.selectedFolderId() === ROOT ? undefined : byId.get(this.selectedFolderId());
    let guard = 0;
    while (current && guard++ < 20) {
      chain.unshift({ id: current._id, name: current.name });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return [...crumbs, ...chain];
  });

  readonly currentFolderName = computed(() => this.folderName(this.selectedFolderId()));

  readonly canCreate = computed(() => this.can('document.create'));
  readonly canUpdate = computed(() => this.can('document.update'));
  readonly canDelete = computed(() => this.can('document.delete'));

  readonly menuItems = computed<ContextMenuItem[]>(() => {
    const target = this.menuTarget();
    if (!target) return [];
    return target.type === 'folder' ? this.folderMenuItems() : this.documentMenuItems(target.document);
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      this.selectedFolderId();
      this.kindFilter();
      this.tagFilter();
      this.pageSize();
      if (this.tenants.activeWorkspace()) {
        untracked(() => {
          this.page.set(1);
          this.load();
        });
      }
    });

    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page.set(1);
      untracked(() => this.load());
    });
  }

  // ------------------------------------------------------------------ load

  load() {
    this.loading.set(true);
    this.state.set('loading');

    const search = this.search().trim();
    this.api
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        // While searching we look through every folder, not just the open one.
        ...(search ? { search } : { folderId: this.selectedFolderId() }),
        ...(this.kindFilter() ? { kind: this.kindFilter() } : {}),
        ...(this.tagFilter() ? { tag: this.tagFilter() } : {})
      })
      .subscribe({
        next: (result) => {
          this.documents.set(result.items);
          this.total.set(result.total);
          this.totalPages.set(result.totalPages);
          if (result.totalPages > 0 && this.page() > result.totalPages) {
            this.page.set(result.totalPages);
          }
          this.loading.set(false);
          this.state.set('ready');
          void this.loadThumbnails(result.items);
        },
        error: () => {
          this.loading.set(false);
          this.state.set('error');
        }
      });

    this.loadFolders();
    this.api.tags().subscribe({ next: (tags) => this.tags.set(tags) });
  }

  private loadFolders() {
    this.api.folders().subscribe({
      next: (folders) => {
        this.folders.set(folders);
        const known = new Set(folders.map((folder) => folder._id));
        if (this.selectedFolderId() !== ROOT && !known.has(this.selectedFolderId())) {
          this.selectedFolderId.set(ROOT);
        }
      }
    });
    // The root bucket is not part of the folder list, so count it separately.
    this.api.list({ folderId: ROOT, pageSize: 1 }).subscribe({
      next: (result) => this.rootCount.set(result.total)
    });
  }

  private async loadThumbnails(items: StoredDocument[]) {
    const images = items.filter(
      (item) => item.kind === 'image' && item.thumbnailFileId && !this.thumbnails().has(item._id)
    );
    for (const image of images) {
      try {
        const { url } = await this.blobs.loadThumbnail(image._id);
        this.thumbnails.update((map) => new Map(map).set(image._id, url));
      } catch {
        // A missing thumbnail just falls back to the type icon.
      }
    }
  }

  onSearchInput(value: string) {
    this.search.set(value);
    this.search$.next(value);
  }

  changePageSize(value: string) {
    const size = Number.parseInt(value, 10);
    if (Number.isFinite(size)) this.pageSize.set(size);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  selectFolder(id: string) {
    this.search.set('');
    this.search$.next('');
    this.selectedFolderId.set(id);
    // Reveal the branch in the tree so the sidebar follows the middle pane.
    if (id !== ROOT) {
      this.expanded.update((set) => {
        const next = new Set(set).add(id);
        let current = this.folders().find((folder) => folder._id === id);
        let guard = 0;
        while (current?.parentId && guard++ < 20) {
          next.add(current.parentId);
          current = this.folders().find((folder) => folder._id === current!.parentId);
        }
        return next;
      });
    }
  }

  toggleFolder(event: Event, id: string) {
    event.stopPropagation();
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  subfolderCount(folderId: string): number {
    return this.folders().filter((folder) => folder.parentId === folderId).length;
  }

  folderName(id: string | null): string {
    if (!id || id === ROOT) return 'Gyökér';
    return this.folders().find((folder) => folder._id === id)?.name ?? 'Gyökér';
  }

  /** How much of the upload was saved by optimising the image. */
  savedPercent(document: StoredDocument): number {
    if (!document.originalSize || document.originalSize <= document.size) return 0;
    return Math.round((1 - document.size / document.originalSize) * 100);
  }

  previewSubtitle(document: StoredDocument): string {
    const parts = [this.kindLabel(document.kind), formatBytes(document.size)];
    if (document.width && document.height) parts.push(`${document.width}×${document.height}`);
    if (document.originalSize) parts.push(`eredeti ${formatBytes(document.originalSize)}`);
    parts.push(document.uploadedByName);
    return parts.join(' · ');
  }

  kindLabel(kind: DocumentKind) {
    return KIND_LABELS[kind] ?? KIND_LABELS.other;
  }

  iconFor(document: StoredDocument): AppIconName {
    return KIND_ICONS[document.kind] ?? 'File';
  }

  private can(permission: string): boolean {
    const user = this.auth.user();
    if (user?.platformAdmin === true || user?.superAdmin === true) return true;
    return this.tenants.activeWorkspace()?.permissions?.includes(permission) === true;
  }

  // ---------------------------------------------------------------- upload

  onFilesPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.uploadFiles(files, this.selectedFolderId());
  }

  onDragOver(event: DragEvent) {
    if (!this.canCreate() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent) {
    // `dragleave` also fires when moving between children, so only clear when
    // the pointer actually left the drop area.
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as HTMLElement).contains(related)) return;
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent) {
    if (!this.canCreate()) return;
    event.preventDefault();
    this.dragActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.uploadFiles(files, this.selectedFolderId());
  }

  onFolderDragOver(event: DragEvent, folderId: string) {
    if (!this.canCreate() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    this.dropFolderId.set(folderId);
  }

  onFolderDragLeave(folderId: string) {
    if (this.dropFolderId() === folderId) this.dropFolderId.set(null);
  }

  onFolderDrop(event: DragEvent, folderId: string) {
    if (!this.canCreate()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dropFolderId.set(null);
    this.dragActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.uploadFiles(files, folderId);
  }

  private async uploadFiles(files: File[], folderId: string) {
    if (files.length === 0) return;
    if (!this.canCreate()) {
      this.toast.error('Nincs jogosultságod dokumentumot feltölteni.');
      return;
    }

    this.uploading.update((count) => count + files.length);
    let succeeded = 0;

    for (const file of files) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.api.upload(file, { folderId: folderId === ROOT ? null : folderId }).subscribe({
            next: () => resolve(),
            error: reject
          });
        });
        succeeded++;
      } catch (error) {
        this.toast.error(`${file.name}: ${this.errorMessage(error)}`);
      } finally {
        this.uploading.update((count) => Math.max(0, count - 1));
      }
    }

    if (succeeded > 0) {
      this.toast.success(
        succeeded === 1 ? 'A dokumentum feltöltve.' : `${succeeded} dokumentum feltöltve.`,
        this.folderName(folderId)
      );
      this.load();
    }
  }

  // ----------------------------------------------------------- context menu

  openDocumentMenu(event: MouseEvent, document: StoredDocument) {
    event.preventDefault();
    event.stopPropagation();
    this.menuX.set(event.clientX);
    this.menuY.set(event.clientY);
    this.menuTarget.set({ type: 'document', document });
  }

  openFolderMenu(event: MouseEvent, folder: DocumentFolder) {
    event.preventDefault();
    event.stopPropagation();
    this.menuX.set(event.clientX);
    this.menuY.set(event.clientY);
    this.menuTarget.set({ type: 'folder', folder });
  }

  closeMenu() {
    this.menuTarget.set(null);
  }

  private documentMenuItems(document: StoredDocument): ContextMenuItem[] {
    const isImage = document.kind === 'image';
    return [
      { id: 'preview', label: 'Előnézet', icon: 'Eye' },
      { id: 'download', label: 'Letöltés', icon: 'Download' },
      {
        id: 'ocr',
        label: 'Szöveg kinyerése és másolása',
        icon: 'ScanText',
        separatorBefore: true,
        disabled: !isImage,
        hint: isImage ? (document.ocrStatus === 'done' ? 'kész' : undefined) : 'csak képnél'
      },
      { id: 'copy-image', label: 'Kép másolása a vágólapra', icon: 'Copy', disabled: !isImage },
      { id: 'copy-name', label: 'Fájlnév másolása', icon: 'Copy' },
      {
        id: 'rename',
        label: 'Átnevezés',
        icon: 'Pencil',
        separatorBefore: true,
        disabled: !this.canUpdate()
      },
      { id: 'tags', label: 'Címkék és megjegyzés', icon: 'Tag', disabled: !this.canUpdate() },
      { id: 'move', label: 'Áthelyezés…', icon: 'FolderInput', disabled: !this.canUpdate() },
      { id: 'duplicate', label: 'Duplikálás', icon: 'CopyPlus', disabled: !this.canCreate() },
      { id: 'copy-to', label: 'Másolat másik mappába…', icon: 'Files', disabled: !this.canCreate() },
      {
        id: 'delete',
        label: 'Törlés',
        icon: 'Trash2',
        danger: true,
        separatorBefore: true,
        disabled: !this.canDelete()
      }
    ];
  }

  private folderMenuItems(): ContextMenuItem[] {
    return [
      { id: 'folder-open', label: 'Megnyitás', icon: 'FolderOpen' },
      { id: 'folder-new-child', label: 'Új almappa', icon: 'FolderPlus', disabled: !this.canUpdate() },
      {
        id: 'folder-rename',
        label: 'Átnevezés',
        icon: 'Pencil',
        separatorBefore: true,
        disabled: !this.canUpdate()
      },
      { id: 'folder-move', label: 'Áthelyezés…', icon: 'FolderInput', disabled: !this.canUpdate() },
      {
        id: 'folder-delete',
        label: 'Törlés',
        icon: 'Trash2',
        danger: true,
        separatorBefore: true,
        disabled: !this.canDelete()
      }
    ];
  }

  runMenuAction(action: string) {
    const target = this.menuTarget();
    if (!target) return;

    if (target.type === 'folder') {
      this.runFolderAction(action, target.folder);
      return;
    }

    const document = target.document;
    switch (action) {
      case 'preview':
        this.openPreview(document);
        break;
      case 'download':
        void this.download(document);
        break;
      case 'ocr':
        void this.runOcr(document);
        break;
      case 'copy-image':
        void this.copyImageToClipboard(document);
        break;
      case 'copy-name':
        void this.copyText(document.name, 'Fájlnév a vágólapra másolva.');
        break;
      case 'rename':
        this.renameForm.setValue({ name: document.name });
        this.renameTarget.set({ kind: 'document', id: document._id });
        break;
      case 'tags':
        this.tagForm.setValue({ tags: document.tags.join(', '), notes: document.notes ?? '' });
        this.tagTarget.set({ id: document._id, name: document.name });
        break;
      case 'move':
        this.moveDestination.set(document.folderId ?? ROOT);
        this.moveTarget.set({
          mode: 'move',
          kind: 'document',
          id: document._id,
          name: document.name,
          disabledIds: []
        });
        break;
      case 'duplicate':
        this.duplicate(document);
        break;
      case 'copy-to':
        this.moveDestination.set(document.folderId ?? ROOT);
        this.moveTarget.set({
          mode: 'copy',
          kind: 'document',
          id: document._id,
          name: document.name,
          disabledIds: []
        });
        break;
      case 'delete':
        void this.remove(document);
        break;
    }
  }

  private runFolderAction(action: string, folder: DocumentFolder) {
    switch (action) {
      case 'folder-open':
        this.selectFolder(folder._id);
        break;
      case 'folder-new-child':
        this.openNewFolder(folder._id);
        break;
      case 'folder-rename':
        this.renameForm.setValue({ name: folder.name });
        this.renameTarget.set({ kind: 'folder', id: folder._id });
        break;
      case 'folder-move':
        this.moveDestination.set(folder.parentId ?? ROOT);
        this.moveTarget.set({
          mode: 'move',
          kind: 'folder',
          id: folder._id,
          name: folder.name,
          // A folder cannot land inside itself or its own subtree.
          disabledIds: this.subtreeIds(folder._id)
        });
        break;
      case 'folder-delete':
        void this.removeFolder(folder);
        break;
    }
  }

  private subtreeIds(rootId: string): string[] {
    const byParent = new Map<string, string[]>();
    for (const folder of this.folders()) {
      const key = folder.parentId ?? ROOT;
      byParent.set(key, [...(byParent.get(key) ?? []), folder._id]);
    }
    const collected: string[] = [];
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      collected.push(current);
      stack.push(...(byParent.get(current) ?? []));
    }
    return collected;
  }

  // -------------------------------------------------------------- preview

  openPreview(document: StoredDocument) {
    this.resetZoom();
    this.preview.set({ document, loading: true });

    this.blobs
      .load(document._id)
      .then(async ({ blob, url }) => {
        const text = document.kind === 'text' ? await blob.text() : undefined;
        this.preview.set({
          document,
          url,
          safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(url),
          text,
          loading: false
        });
      })
      .catch((error) => {
        this.preview.set({ document, loading: false, error: this.errorMessage(error) });
      });
  }

  closePreview() {
    this.preview.set(null);
    this.resetZoom();
  }

  // ----------------------------------------------------------- image zoom

  zoomBy(factor: number) {
    this.smoothZoom.set(true);
    this.applyZoom(this.zoom() * factor);
  }

  resetZoom() {
    this.smoothZoom.set(true);
    this.zoom.set(1);
    this.offset.set({ x: 0, y: 0 });
  }

  /** Double click zooms in on the spot that was clicked, or back to fit. */
  toggleZoom(event: MouseEvent) {
    this.smoothZoom.set(true);
    if (this.zoom() > 1) {
      this.resetZoom();
      return;
    }
    this.applyZoom(2.5, this.focusPoint(event.clientX, event.clientY));
  }

  onZoomWheel(event: WheelEvent) {
    if (!this.previewImage()) return;
    event.preventDefault();
    this.smoothZoom.set(false);
    // Exponential so every wheel notch feels the same at any zoom level.
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.applyZoom(this.zoom() * factor, this.focusPoint(event.clientX, event.clientY));
  }

  onPanStart(event: PointerEvent) {
    if (this.zoom() <= this.minZoom || event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.smoothZoom.set(false);
    this.panning.set(true);
    const { x, y } = this.offset();
    this.panStart = { x: event.clientX, y: event.clientY, ox: x, oy: y };
  }

  onPanMove(event: PointerEvent) {
    const start = this.panStart;
    if (!start) return;
    this.offset.set(
      this.clampOffset(
        { x: start.ox + (event.clientX - start.x), y: start.oy + (event.clientY - start.y) },
        this.zoom()
      )
    );
  }

  onPanEnd(event: PointerEvent) {
    if (!this.panStart) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.panning.set(false);
    this.panStart = null;
  }

  @HostListener('document:keydown', ['$event'])
  onPreviewKeydown(event: KeyboardEvent) {
    const item = this.preview();
    if (!item || item.document.kind !== 'image' || event.metaKey || event.ctrlKey) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomBy(this.zoomStep);
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomBy(1 / this.zoomStep);
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  }

  /** Pointer position relative to the viewport centre, which is the scale origin. */
  private focusPoint(clientX: number, clientY: number) {
    const viewport = this.previewImage()?.nativeElement.parentElement;
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  private applyZoom(next: number, focus: { x: number; y: number } = { x: 0, y: 0 }) {
    const target = Math.min(this.maxZoom, Math.max(this.minZoom, next));
    const current = this.zoom();
    if (Math.abs(target - current) < 0.0001) return;

    // Scale around the focus point so it stays under the cursor.
    const ratio = target / current;
    const { x, y } = this.offset();
    const moved = { x: focus.x - (focus.x - x) * ratio, y: focus.y - (focus.y - y) * ratio };

    this.zoom.set(target);
    this.offset.set(this.clampOffset(moved, target));
  }

  /** Stops the image from being dragged past the edges of the viewport. */
  private clampOffset(offset: { x: number; y: number }, zoom: number) {
    const image = this.previewImage()?.nativeElement;
    const viewport = image?.parentElement;
    if (!image || !viewport) return zoom <= 1 ? { x: 0, y: 0 } : offset;

    const maxX = Math.max(0, (image.clientWidth * zoom - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.clientHeight * zoom - viewport.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y))
    };
  }

  async download(document: StoredDocument) {
    try {
      const { url } = await this.blobs.load(document._id);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      link.click();
    } catch (error) {
      this.toast.error(this.errorMessage(error));
    }
  }

  // ------------------------------------------------------------------ OCR

  async runOcr(document: StoredDocument, force = false) {
    if (document.kind !== 'image') {
      this.toast.warning('Szövegfelismerés csak képekhez érhető el.');
      return;
    }

    this.ocrRunning.set(true);
    this.api.recognizeText(document._id, force).subscribe({
      next: async (result) => {
        this.ocrRunning.set(false);
        const text = result.text?.trim() ?? '';
        this.ocrPanel.set({ documentId: document._id, documentName: document.name, text });
        if (text.length > 0) {
          const copied = await this.writeClipboardText(text);
          this.toast.success(
            copied ? 'A felismert szöveg a vágólapon van.' : 'Kész a szövegfelismerés.',
            document.name
          );
        }
        // Refresh the row so the cached-OCR hint shows up next time.
        this.documents.update((items) =>
          items.map((item) => (item._id === document._id ? { ...item, ocrStatus: 'done' } : item))
        );
      },
      error: (error) => {
        this.ocrRunning.set(false);
        this.toast.error(this.errorMessage(error), 'Szövegfelismerés');
      }
    });
  }

  rerunOcr(documentId: string) {
    const document = this.documents().find((item) => item._id === documentId);
    if (document) void this.runOcr(document, true);
  }

  async copyText(text: string, message = 'A szöveg a vágólapon van.') {
    const copied = await this.writeClipboardText(text);
    if (copied) this.toast.success(message);
    else this.toast.error('A böngésző nem engedte a vágólapra másolást.');
  }

  /** Copies an image as PNG so it can be pasted into mail or chat. */
  async copyImageToClipboard(document: StoredDocument) {
    if (document.kind !== 'image') return;
    try {
      const { blob } = await this.blobs.load(document._id);
      const png = blob.type === 'image/png' ? blob : await this.toPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      this.toast.success('A kép a vágólapon van.');
    } catch {
      this.toast.error('A böngésző nem engedte a kép vágólapra másolását.');
    }
  }

  private async toPng(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = window.document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Nem sikerült a képet átalakítani');
    context.drawImage(bitmap, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Sikertelen átalakítás'))), 'image/png');
    });
  }

  private async writeClipboardText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------- mutations

  submitRename() {
    const target = this.renameTarget();
    if (!target || this.renameForm.invalid) return;
    const name = this.renameForm.getRawValue().name.trim();
    if (!name) return;

    this.saving.set(true);
    const request: Observable<unknown> =
      target.kind === 'folder'
        ? this.api.updateFolder(target.id, { name })
        : this.api.update(target.id, { name });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.renameTarget.set(null);
        this.toast.success('Átnevezve.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error(this.errorMessage(error));
      }
    });
  }

  openNewFolder(parentId: string | null) {
    this.folderForm.reset({ name: '' });
    this.newFolderParent.set(parentId ?? ROOT);
  }

  submitNewFolder() {
    const parent = this.newFolderParent();
    if (parent === null || this.folderForm.invalid) return;
    const name = this.folderForm.getRawValue().name.trim();
    if (!name) return;

    this.saving.set(true);
    this.api.createFolder(name, parent === ROOT ? null : parent).subscribe({
      next: (folder) => {
        this.saving.set(false);
        this.newFolderParent.set(null);
        if (parent !== ROOT) {
          this.expanded.update((set) => new Set(set).add(parent));
        }
        this.toast.success(`"${folder.name}" mappa létrehozva.`);
        this.loadFolders();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error(this.errorMessage(error));
      }
    });
  }

  submitMove() {
    const target = this.moveTarget();
    if (!target) return;
    const destination = this.moveDestination();

    this.saving.set(true);
    const request: Observable<unknown> =
      target.kind === 'folder'
        ? this.api.updateFolder(target.id, { parentId: destination })
        : target.mode === 'copy'
          ? this.api.duplicate(target.id, destination)
          : this.api.update(target.id, { folderId: destination });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.moveTarget.set(null);
        this.toast.success(
          target.mode === 'copy' ? `Másolat a(z) "${this.folderName(destination)}" mappában.` : 'Áthelyezve.'
        );
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error(this.errorMessage(error));
      }
    });
  }

  submitTags() {
    const target = this.tagTarget();
    if (!target) return;
    const { tags, notes } = this.tagForm.getRawValue();

    this.saving.set(true);
    this.api
      .update(target.id, {
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        notes
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.tagTarget.set(null);
          this.toast.success('Mentve.');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(this.errorMessage(error));
        }
      });
  }

  duplicate(document: StoredDocument) {
    this.api.duplicate(document._id).subscribe({
      next: (copy) => {
        this.toast.success(`Létrejött: ${copy.name}`);
        this.load();
      },
      error: (error) => this.toast.error(this.errorMessage(error))
    });
  }

  async remove(document: StoredDocument) {
    const confirmed = await this.confirm.confirm({
      title: 'Dokumentum törlése',
      message: `Biztosan törlöd a(z) "${document.name}" dokumentumot? A fájl véglegesen elvész.`,
      confirmLabel: 'Törlés',
      cancelLabel: 'Mégse',
      danger: true
    });
    if (!confirmed) return;

    this.api.remove(document._id).subscribe({
      next: () => {
        this.blobs.invalidate(document._id);
        this.thumbnails.update((map) => {
          const next = new Map(map);
          next.delete(document._id);
          return next;
        });
        this.toast.success('A dokumentum törölve.');
        this.load();
      },
      error: (error) => this.toast.error(this.errorMessage(error))
    });
  }

  async removeFolder(folder: DocumentFolder) {
    const subtree = this.subtreeIds(folder._id);
    const documentCount = this.folders()
      .filter((item) => subtree.includes(item._id))
      .reduce((sum, item) => sum + item.documentCount, 0);

    const confirmed = await this.confirm.confirm({
      title: 'Mappa törlése',
      message:
        subtree.length > 1 || documentCount > 0
          ? `A(z) "${folder.name}" mappa törlésével ${subtree.length - 1} almappa és ${documentCount} dokumentum is véglegesen törlődik.`
          : `Biztosan törlöd a(z) "${folder.name}" mappát?`,
      confirmLabel: 'Törlés',
      cancelLabel: 'Mégse',
      danger: true
    });
    if (!confirmed) return;

    this.api.deleteFolder(folder._id).subscribe({
      next: (result) => {
        if (subtree.includes(this.selectedFolderId())) this.selectedFolderId.set(ROOT);
        this.toast.success(
          `Törölve: ${result.deletedFolders} mappa, ${result.deletedDocuments} dokumentum.`
        );
        this.load();
      },
      error: (error) => this.toast.error(this.errorMessage(error))
    });
  }

  private errorMessage(error: unknown): string {
    const message = (error as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    return 'Váratlan hiba történt.';
  }
}
