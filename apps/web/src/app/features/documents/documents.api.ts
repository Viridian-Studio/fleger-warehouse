import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type DocumentKind = 'image' | 'pdf' | 'word' | 'sheet' | 'text' | 'other';
export type OcrStatus = 'none' | 'processing' | 'done' | 'failed' | 'unsupported';

export interface StoredDocument {
  _id: string;
  folderId: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  kind: DocumentKind;
  size: number;
  /** Upload size before image optimisation; absent when nothing was saved. */
  originalSize?: number;
  width?: number;
  height?: number;
  thumbnailFileId?: string;
  tags: string[];
  notes?: string;
  uploadedBy: string;
  uploadedByName: string;
  ocrStatus: OcrStatus;
  ocrAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFolder {
  _id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  createdAt?: string;
}

export interface DocumentPage {
  items: StoredDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OcrResult {
  status: OcrStatus;
  text: string;
  cached?: boolean;
  ocrAt?: string;
}

export interface DocumentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** `root`, a folder id, or omitted to search across every folder. */
  folderId?: string;
  kind?: string;
  tag?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/documents`;

  list(query: DocumentQuery): Observable<DocumentPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<DocumentPage>(this.base, { params });
  }

  folders() {
    return this.http.get<DocumentFolder[]>(`${this.base}/folders`);
  }

  tags() {
    return this.http.get<string[]>(`${this.base}/tags`);
  }

  createFolder(name: string, parentId: string | null) {
    return this.http.post<DocumentFolder>(`${this.base}/folders`, {
      name,
      ...(parentId ? { parentId } : {})
    });
  }

  updateFolder(id: string, patch: { name?: string; parentId?: string }) {
    return this.http.patch<DocumentFolder>(`${this.base}/folders/${id}`, patch);
  }

  deleteFolder(id: string) {
    return this.http.delete<{ deletedFolders: number; deletedDocuments: number }>(
      `${this.base}/folders/${id}`
    );
  }

  upload(file: File, options: { folderId?: string | null; tags?: string[]; notes?: string }) {
    const form = new FormData();
    form.append('file', file, file.name);
    if (options.folderId) form.append('folderId', options.folderId);
    if (options.tags?.length) form.append('tags', options.tags.join(','));
    if (options.notes) form.append('notes', options.notes);
    return this.http.post<StoredDocument>(this.base, form);
  }

  update(id: string, patch: { name?: string; folderId?: string; tags?: string[]; notes?: string }) {
    return this.http.patch<StoredDocument>(`${this.base}/${id}`, patch);
  }

  duplicate(id: string, folderId?: string) {
    return this.http.post<StoredDocument>(`${this.base}/${id}/duplicate`, folderId ? { folderId } : {});
  }

  remove(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }

  content(id: string) {
    return this.http.get(`${this.base}/${id}/content`, { responseType: 'blob' });
  }

  thumbnail(id: string) {
    return this.http.get(`${this.base}/${id}/thumbnail`, { responseType: 'blob' });
  }

  storedText(id: string) {
    return this.http.get<OcrResult>(`${this.base}/${id}/text`);
  }

  recognizeText(id: string, force = false) {
    return this.http.post<OcrResult>(`${this.base}/${id}/text`, { force });
  }
}
