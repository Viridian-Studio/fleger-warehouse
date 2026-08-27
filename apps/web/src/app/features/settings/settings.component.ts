import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { AuthStore, AuthUser } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { IconDirective } from '../../shared/ui/icon.directive';
import { ToastService } from '../../shared/ui/toast.service';

interface Tenant {
  name: string;
  slug: string;
  planCode: string;
  settings?: Record<string, string>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective],
  template: `
    <section class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Settings</h1>
          <p>Manage your account and workspace configuration.</p>
        </div>
      </div>

      <!-- Account section -->
      <div class="card account-card">
        <div class="card-head">
          <div>
            <h2><span appIcon="User" [size]="18"></span> Account</h2>
            <p>Your personal profile and password.</p>
          </div>
        </div>
        <div class="card-body">
          <div class="account-grid">
            <!-- Profile form -->
            <form class="subform" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
              <h3>Profile</h3>
              <div class="form-grid">
                <label class="field">
                  <span class="field-label">Username</span>
                  <input formControlName="username" />
                </label>
                <label class="field">
                  <span class="field-label">Email</span>
                  <input type="email" formControlName="email" />
                </label>
              </div>
              <button class="btn btn--primary btn--sm" type="submit" [class.btn--loading]="savingProfile()" [disabled]="profileForm.invalid || savingProfile()">
                @if (savingProfile()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="14"></span> }
                Save profile
              </button>
            </form>

            <!-- Password form -->
            <form class="subform" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
              <h3>Change password</h3>
              <label class="field">
                <span class="field-label">Current password</span>
                <input type="password" formControlName="currentPassword" autocomplete="current-password" />
              </label>
              <label class="field">
                <span class="field-label">New password</span>
                <input type="password" formControlName="newPassword" autocomplete="new-password" />
              </label>
              <label class="field">
                <span class="field-label">Confirm new password</span>
                <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
              </label>
              @if (passwordForm.controls.confirmPassword.value && passwordForm.controls.newPassword.value !== passwordForm.controls.confirmPassword.value) {
                <p class="field-error">Passwords do not match.</p>
              }
              <button class="btn btn--secondary btn--sm" type="submit" [class.btn--loading]="savingPassword()" [disabled]="passwordForm.invalid || passwordsMismatch() || savingPassword()">
                @if (savingPassword()) { <span class="spinner"></span> } @else { <span appIcon="KeyRound" [size]="14"></span> }
                Update password
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Workspace section -->
      @if (tenant()) {
        <div class="cluster" style="gap: var(--space-2)">
          <span class="badge badge--brand">{{ tenant()?.slug }}</span>
          <span class="badge badge--muted">{{ tenant()?.planCode }}</span>
        </div>
      }

      <form class="card settings-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="card-head">
          <div>
            <h2><span appIcon="Building2" [size]="18"></span> Workspace details</h2>
            <p>These values apply across the active workspace.</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span class="field-label">Company name</span><input formControlName="companyName" /></label>
            <label class="field"><span class="field-label">Timezone</span><input formControlName="timezone" /></label>
            <label class="field"><span class="field-label">Locale</span><input formControlName="locale" /></label>
            <label class="field"><span class="field-label">Date format</span><input formControlName="dateFormat" /></label>
            <label class="field"><span class="field-label">Currency</span><input formControlName="defaultCurrency" /></label>
          </div>
        </div>
        <div class="card-head" style="border-top: 1px solid var(--line); border-bottom: 0; justify-content: flex-end">
          <button class="btn btn--primary" type="submit" [class.btn--loading]="saving()" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> } @else { <span appIcon="Save" [size]="16"></span> }
            Save settings
          </button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .account-card { padding: 0; margin-bottom: var(--space-5); }
    .account-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); }
    .subform { display: grid; gap: var(--space-3); }
    .subform h3 { font-size: 14px; font-weight: 600; margin: 0; color: var(--ink-strong); }
    .settings-form { padding: 0; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
    .field-error { color: var(--danger); font-size: 12px; margin: -4px 0 0; }
    @media (max-width: 860px) {
      .account-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) { .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly tenants = inject(TenantStore);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthStore);
  readonly tenant = signal<Tenant | null>(null);
  readonly saving = signal(false);
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly form = this.fb.nonNullable.group({
    companyName: [''],
    timezone: ['Europe/Budapest'],
    locale: ['hu-HU'],
    dateFormat: ['yyyy-MM-dd'],
    defaultCurrency: ['HUF']
  });
  readonly profileForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]]
  });
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    effect(() => {
      this.tenants.version();
      if (this.tenants.activeWorkspace()) untracked(() => this.load());
    });

    untracked(() => this.loadProfile());
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

  loadProfile() {
    const user = this.auth.user();
    if (!user) return;
    this.profileForm.patchValue({ username: user.username, email: user.email });
  }

  save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.patch<Tenant>('/tenants/settings', this.form.getRawValue()).subscribe({
      next: (tenant) => {
        this.saving.set(false);
        this.tenant.set(tenant);
        this.toasts.success('Settings saved.');
      },
      error: () => {
        this.saving.set(false);
        this.toasts.error('Could not save settings.');
      }
    });
  }

  saveProfile() {
    if (this.profileForm.invalid || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.api.patch<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/profile', this.profileForm.getRawValue()).subscribe({
      next: (response) => {
        this.savingProfile.set(false);
        this.auth.login(response.accessToken, response.refreshToken, response.user);
        this.toasts.success('Profile updated.');
      },
      error: (error) => {
        this.savingProfile.set(false);
        const message = error?.error?.message ?? 'Could not update profile.';
        this.toasts.error(message);
      }
    });
  }

  passwordsMismatch() {
    return this.passwordForm.controls.newPassword.value !== this.passwordForm.controls.confirmPassword.value;
  }

  changePassword() {
    if (this.passwordForm.invalid || this.passwordsMismatch() || this.savingPassword()) return;
    this.savingPassword.set(true);
    this.api.post('/auth/change-password', {
      currentPassword: this.passwordForm.controls.currentPassword.value,
      newPassword: this.passwordForm.controls.newPassword.value
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        this.toasts.success('Password changed.');
      },
      error: (error) => {
        this.savingPassword.set(false);
        const message = error?.error?.message ?? 'Could not change password.';
        this.toasts.error(message);
      }
    });
  }
}
