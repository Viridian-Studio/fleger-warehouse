import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore, AuthUser } from '../../core/auth/auth.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ThemeService } from '../../core/theme/theme.service';
import { ApiService } from '../../core/api/api.service';
import { IconDirective } from '../../shared/ui/icon.directive';
import { TooltipDirective } from '../../shared/ui/tooltip.directive';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface ChangePasswordResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, TooltipDirective, TranslatePipe],
  template: `
    <main class="login-page">
      <button class="theme-toggle" type="button" (click)="theme.toggle()" [appTooltip]="theme.theme() === 'dark' ? 'Switch to light' : 'Switch to dark'">
        <span [appIcon]="theme.theme() === 'dark' ? 'Sun' : 'Moon'" [size]="18"></span>
      </button>

      <section class="login-panel">
        <div class="brand-row">
          <div class="brand-mark">
            <img src="/assets/viridian_fox_logo_white.png" alt="Viridian Studio" (error)="hideBrokenLogo($event)" />
          </div>
          <div>
            <p class="eyebrow">Viridian Warehouse</p>
            <h1>{{ 'login.title' | translate }}</h1>
          </div>
        </div>
        <p class="lead">{{ 'login.lead' | translate }}</p>

        @if (mustChangePassword()) {
          <div class="alert alert--warning">
            <span class="alert-icon" appIcon="KeyRound" [size]="18"></span>
            <div class="alert-body">
              <strong>Password change required</strong>
              <p>Please set a new password to continue.</p>
            </div>
          </div>

          <form [formGroup]="changePasswordForm" (ngSubmit)="submitNewPassword()">
            <label class="field">
              <span class="field-label">New password</span>
              <div class="input-affix">
                <span class="affix-icon" appIcon="Key" [size]="16"></span>
                <input type="password" formControlName="newPassword" autocomplete="new-password" />
              </div>
            </label>

            <label class="field">
              <span class="field-label">Confirm new password</span>
              <div class="input-affix">
                <span class="affix-icon" appIcon="Key" [size]="16"></span>
                <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
              </div>
            </label>

            @if (changePasswordError()) {
              <div class="alert alert--error">
                <span class="alert-icon" appIcon="CircleAlert" [size]="18"></span>
                <div class="alert-body"><p>{{ changePasswordError() }}</p></div>
              </div>
            }

            @if (changePasswordForm.controls.confirmPassword.value && changePasswordForm.controls.newPassword.value !== changePasswordForm.controls.confirmPassword.value) {
              <p class="field-error">Passwords do not match.</p>
            }

            <button class="btn btn--primary btn--lg btn--block" type="submit" [class.btn--loading]="changingPassword()" [disabled]="changePasswordForm.invalid || changePasswordForm.controls.newPassword.value !== changePasswordForm.controls.confirmPassword.value || changingPassword()">
              @if (changingPassword()) {
                <span class="spinner" aria-hidden="true"></span>
              } @else {
                <span appIcon="KeyRound" [size]="18"></span>
              }
              Set new password
            </button>
          </form>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label class="field">
              <span class="field-label">{{ 'login.emailOrUsername' | translate }}</span>
              <div class="input-affix">
                <span class="affix-icon" appIcon="User" [size]="16"></span>
                <input type="email" formControlName="email" autocomplete="email" />
              </div>
            </label>

            <label class="field">
              <span class="field-label">{{ 'login.password' | translate }}</span>
              <div class="input-affix">
                <span class="affix-icon" appIcon="Key" [size]="16"></span>
                <input type="password" formControlName="password" autocomplete="current-password" />
              </div>
            </label>

            @if (error()) {
              <div class="alert alert--error">
                <span class="alert-icon" appIcon="CircleAlert" [size]="18"></span>
                <div class="alert-body"><p>{{ error() }}</p></div>
              </div>
            }

            <button class="btn btn--primary btn--lg btn--block" type="submit" [class.btn--loading]="loading()" [disabled]="form.invalid || loading()">
              @if (loading()) {
                <span class="spinner" aria-hidden="true"></span>
              } @else {
                <span appIcon="ArrowRight" [size]="18"></span>
              }
              {{ loading() ? ('login.signingIn' | translate) : ('login.signIn' | translate) }}
            </button>
          </form>
        }

      </section>
    </main>
  `,
  styles: [`
    .login-page {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: var(--space-6);
      overflow-x: hidden;
      background: radial-gradient(circle at 20% 10%, var(--brand-soft), transparent 45%),
                  radial-gradient(circle at 80% 90%, var(--accent-soft), transparent 45%),
                  var(--bg);
    }
    .theme-toggle {
      position: absolute; top: var(--space-5); right: var(--space-5);
      display: inline-grid; place-items: center;
      width: 40px; height: 40px;
      border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: var(--surface); color: var(--ink);
      box-shadow: var(--shadow-sm);
    }
    .theme-toggle:hover { background: var(--surface-hover); }
    .login-panel {
      width: 100%;
      max-width: 440px;
      display: grid;
      gap: var(--space-5);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--surface);
      padding: var(--space-8);
      box-shadow: var(--shadow-lg);
      animation: panel-in var(--dur-slow) var(--ease-out);
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand-row { display: flex; align-items: center; gap: var(--space-3); }
    .brand-mark {
      display: grid; place-items: center;
      width: 48px; height: 48px; flex: 0 0 auto;
      overflow: hidden; border-radius: var(--radius);
      background: var(--ink-strong);
    }
    .brand-mark img { width: 32px; height: 32px; object-fit: contain; }
    .eyebrow { margin: 0 0 4px; color: var(--brand-ink); font-weight: 700; }
    h1 { margin: 0; font-size: 24px; }
    .lead { margin: 0; color: var(--muted); line-height: 1.5; font-size: 14px; }
    form { display: grid; gap: var(--space-4); }
    .field { display: grid; gap: 6px; min-width: 0; }
    .field-label { color: var(--ink); font-size: 13px; font-weight: 600; }
    .input-affix { position: relative; display: flex; align-items: center; }
    .input-affix > input { padding-left: var(--space-8); }
    .input-affix .affix-icon { position: absolute; left: var(--space-3); color: var(--muted); pointer-events: none; display: inline-flex; }
    .demo {
      display: grid; gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--line);
    }
    .demo-users { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .demo-users .chip { font-size: 12px; }
    .demo-users .chip span { color: var(--muted); }
    .demo-notes { display: flex; flex-wrap: wrap; gap: var(--space-3); }
    .demo-notes small { color: var(--muted); display: inline-flex; align-items: center; gap: 6px; }
    .field-error { color: var(--danger); font-size: 12px; margin: -4px 0 0; }
  `]
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);
  private readonly tenants = inject(TenantStore);
  private readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly mustChangePassword = signal(false);
  readonly changingPassword = signal(false);
  readonly changePasswordError = signal('');
  readonly pendingLogin = signal<LoginResponse | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });
  readonly changePasswordForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    this.http.post<LoginResponse>(
      `${environment.apiBaseUrl}/auth/login`,
      this.form.getRawValue()
    ).subscribe({
      next: (response) => {
        if (response.user.passwordMustChange) {
          this.auth.login(response.accessToken, response.refreshToken, response.user);
          this.tenants.setWorkspaces(response.user.memberships);
          this.pendingLogin.set(response);
          this.mustChangePassword.set(true);
          this.loading.set(false);
        } else {
          this.auth.login(response.accessToken, response.refreshToken, response.user);
          this.tenants.setWorkspaces(response.user.memberships);
          void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
        }
      },
      error: () => {
        this.error.set(this.i18n.t('login.error'));
        this.loading.set(false);
      }
    });
  }

  submitNewPassword() {
    if (this.changePasswordForm.invalid || this.changingPassword()) return;
    const newPassword = this.changePasswordForm.controls.newPassword.value;
    const confirmPassword = this.changePasswordForm.controls.confirmPassword.value;
    if (newPassword !== confirmPassword) return;

    this.changingPassword.set(true);
    this.changePasswordError.set('');

    this.api.post<ChangePasswordResponse>('/auth/change-password', {
      currentPassword: this.form.controls.password.value,
      newPassword
    }).subscribe({
      next: (response) => {
        this.auth.login(response.accessToken, response.refreshToken, response.user);
        this.tenants.setWorkspaces(response.user.memberships);
        this.changingPassword.set(false);
        this.mustChangePassword.set(false);
        void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
      },
      error: (error) => {
        this.changingPassword.set(false);
        const message = error?.error?.message ?? 'Could not change password.';
        this.changePasswordError.set(message);
      }
    });
  }

  hideBrokenLogo(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
