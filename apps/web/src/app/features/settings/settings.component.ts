import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { TenantStore } from '../../core/tenant/tenant.store';

interface Tenant {
  name: string;
  slug: string;
  planCode: string;
  settings?: Record<string, string>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page">
      <h1>Settings</h1>
      <form class="data-card" [formGroup]="form" (ngSubmit)="save()">
        <label>Company name<input formControlName="companyName" /></label>
        <label>Timezone<input formControlName="timezone" /></label>
        <label>Locale<input formControlName="locale" /></label>
        <label>Date format<input formControlName="dateFormat" /></label>
        <label>Currency<input formControlName="defaultCurrency" /></label>
        <button type="submit">Save settings</button>
      </form>
      @if (tenant()) {
        <p>{{ tenant()?.name }} · {{ tenant()?.slug }} · {{ tenant()?.planCode }}</p>
      }
    </section>
  `,
  styles: `
    .page { display: grid; gap: 18px; max-width: 720px; }
    h1 { margin: 0; font-size: 28px; }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 7px; color: var(--muted); font-size: 14px; font-weight: 700; }
    input { height: 40px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; color: var(--ink); }
    button { width: fit-content; height: 38px; border: 0; border-radius: 8px; padding: 0 14px; background: var(--brand); color: white; }
    p { margin: 0; color: var(--muted); }
  `
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly tenants = inject(TenantStore);
  readonly tenant = signal<Tenant | null>(null);
  readonly form = this.fb.nonNullable.group({
    companyName: [''],
    timezone: ['Europe/Budapest'],
    locale: ['hu-HU'],
    dateFormat: ['yyyy-MM-dd'],
    defaultCurrency: ['HUF']
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) this.load();
    });
  }

  load() {
    this.api.get<Tenant>('/tenants/current').subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.form.patchValue({
          companyName: tenant.settings?.['companyName'] ?? tenant.name,
          timezone: tenant.settings?.['timezone'] ?? 'Europe/Budapest',
          locale: tenant.settings?.['locale'] ?? 'hu-HU',
          dateFormat: tenant.settings?.['dateFormat'] ?? 'yyyy-MM-dd',
          defaultCurrency: tenant.settings?.['defaultCurrency'] ?? 'HUF'
        });
      }
    });
  }

  save() {
    this.api.patch<Tenant>('/tenants/settings', this.form.getRawValue()).subscribe({
      next: (tenant) => this.tenant.set(tenant)
    });
  }
}
