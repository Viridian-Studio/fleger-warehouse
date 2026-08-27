import { effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.readInitial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      localStorage.setItem('fleger.theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    });
  }

  toggle() {
    this.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme) {
    this.theme.set(theme);
  }

  private readInitial(): Theme {
    const stored = localStorage.getItem('fleger.theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
