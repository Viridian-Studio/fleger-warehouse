import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentsApi } from './documents.api';

interface CachedBlob {
  blob: Blob;
  url: string;
}

/**
 * Document bytes need the auth header, so they cannot be dropped straight into
 * an `img src`. This fetches them once and hands out object URLs instead,
 * keeping thumbnails and the preview modal on a single download per document.
 */
@Injectable({ providedIn: 'root' })
export class DocumentBlobCache {
  private readonly api = inject(DocumentsApi);
  private readonly entries = new Map<string, CachedBlob>();
  private readonly inFlight = new Map<string, Promise<CachedBlob>>();

  async load(id: string): Promise<CachedBlob> {
    return this.fetch(id, () => this.api.content(id));
  }

  /** Small preview image — a fraction of the full document's bytes. */
  async loadThumbnail(id: string): Promise<CachedBlob> {
    return this.fetch(`${id}:thumb`, () => this.api.thumbnail(id));
  }

  private async fetch(key: string, request: () => Observable<Blob>): Promise<CachedBlob> {
    const cached = this.entries.get(key);
    if (cached) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const load = firstValueFrom(request())
      .then((blob) => {
        const entry: CachedBlob = { blob, url: URL.createObjectURL(blob) };
        this.entries.set(key, entry);
        return entry;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, load);
    return load;
  }

  peek(id: string): CachedBlob | undefined {
    return this.entries.get(id);
  }

  invalidate(id: string) {
    for (const key of [id, `${id}:thumb`]) {
      const entry = this.entries.get(key);
      if (!entry) continue;
      URL.revokeObjectURL(entry.url);
      this.entries.delete(key);
    }
  }

  clear() {
    for (const entry of this.entries.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.entries.clear();
  }
}
