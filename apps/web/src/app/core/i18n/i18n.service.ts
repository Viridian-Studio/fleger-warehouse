import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);
  readonly lang = signal<string>(localStorage.getItem('fleger.lang') ?? 'hu');
  readonly translations = signal<Record<string, Record<string, unknown>>>({});

  constructor() {
    effect(() => {
      localStorage.setItem('fleger.lang', this.lang());
    });

    this.load();
  }

  setLang(language: string) {
    this.lang.set(language);
  }

  private load() {
    this.http.get<Record<string, Record<string, unknown>>>('/assets/i18n/translations.json').subscribe({
      next: (data: Record<string, Record<string, unknown>>) => this.translations.set(data),
      error: () => this.translations.set({})
    });
  }

  t(key: string): string {
    const language = this.lang();
    const dictionary = this.translations()[language] ?? this.translations()['en'] ?? {};
    const parts = key.split('.');
    let value: unknown = dictionary;
    for (const part of parts) {
      if (value === null || typeof value !== 'object') return key;
      value = (value as Record<string, unknown>)[part];
    }
    return typeof value === 'string' ? value : key;
  }
}
