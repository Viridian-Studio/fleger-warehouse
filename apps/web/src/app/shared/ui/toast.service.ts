import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 1;

  success(message: string, title?: string) {
    this.show('success', message, title);
  }

  error(message: string, title?: string) {
    this.show('error', message, title);
  }

  info(message: string, title?: string) {
    this.show('info', message, title);
  }

  warning(message: string, title?: string) {
    this.show('warning', message, title);
  }

  dismiss(id: number) {
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }

  private show(type: ToastType, message: string, title?: string) {
    const id = this.nextId++;
    this.messages.update((messages) => [...messages, { id, type, message, title }]);
    window.setTimeout(() => this.dismiss(id), 4600);
  }
}
