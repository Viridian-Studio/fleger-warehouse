import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 1;

  success(message: string) {
    this.show('success', message);
  }

  error(message: string) {
    this.show('error', message);
  }

  info(message: string) {
    this.show('info', message);
  }

  dismiss(id: number) {
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }

  private show(type: ToastType, message: string) {
    const id = this.nextId++;
    this.messages.update((messages) => [...messages, { id, type, message }]);
    window.setTimeout(() => this.dismiss(id), 4200);
  }
}
