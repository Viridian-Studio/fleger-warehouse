import { Injectable, signal } from '@angular/core';
import { ConfirmOptions } from './confirm-dialog.component';

export interface ConfirmState extends ConfirmOptions {
  id: number;
  loading: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);
  private nextId = 1;
  private resolver: ((value: boolean) => void) | null = null;

  /** Opens a confirm dialog and resolves to true when confirmed, false otherwise. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    this.close();
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.state.set({ id: this.nextId++, loading: false, ...options });
    });
  }

  /** Marks the active dialog as loading (e.g. while a deletion request is in flight). */
  setLoading(loading: boolean) {
    const current = this.state();
    if (current) this.state.set({ ...current, loading });
  }

  resolve(confirmed: boolean) {
    if (this.resolver) {
      this.resolver(confirmed);
      this.resolver = null;
    }
    this.state.set(null);
  }

  private close() {
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
    this.state.set(null);
  }
}
