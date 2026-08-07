import { Component, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthStore, AuthUser } from "../../core/auth/auth.store";
import { TenantStore } from "../../core/tenant/tenant.store";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Component({
  selector: "app-login",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="login-page">
      <section class="login-panel">
        <div>
          <p class="eyebrow">Viridian Warehouse</p>
          <h1>Sign in</h1>
          <p class="lead">
            Inventory, fleet and team operations in one tenant-safe workspace.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Email or username
            <input
              type="text"
              formControlName="email"
              autocomplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
          </label>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? "Signing in..." : "Sign in" }}
          </button>
        </form>

        <div class="demo">
          <strong>Demo users</strong>
          <span>platform@fleger.test</span>
          <span>jovanovicsp@gmail.com</span>
          <span>admin@acme.test</span>
          <span>admin@demo.test</span>
          <small>Fleger password: Nemtom10</small>
          <small>Demo password: Password123!</small>
        </div>
      </section>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow-x: hidden;
      background: linear-gradient(
        145deg,
        #f4f6f8 0%,
        #eef4f1 52%,
        #eef2fa 100%
      );
    }
    .login-panel {
      width: calc(100vw - 48px);
      max-width: 440px;
      display: grid;
      gap: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      padding: 30px;
      box-shadow: 0 20px 70px rgba(20, 32, 51, 0.14);
    }
    .eyebrow {
      margin: 0 0 6px;
      color: var(--brand);
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: 30px;
    }
    .lead {
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.45;
    }
    form {
      display: grid;
      gap: 14px;
    }
    label {
      display: grid;
      gap: 7px;
      min-width: 0;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
    }
    input {
      width: 100%;
      min-width: 0;
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      color: var(--ink);
    }
    button {
      width: 100%;
      min-width: 0;
      height: 42px;
      border: 0;
      border-radius: 8px;
      background: var(--brand);
      color: white;
      font-weight: 700;
    }
    button:disabled {
      opacity: 0.6;
    }
    .error {
      margin: 0;
      color: #b42318;
      font-size: 14px;
    }
    .demo {
      display: grid;
      gap: 5px;
      min-width: 0;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .demo strong {
      color: var(--ink);
    }
  `,
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);
  private readonly tenants = inject(TenantStore);

  readonly loading = signal(false);
  readonly error = signal("");
  readonly form = this.fb.nonNullable.group({
    email: ["jovanovicsp@gmail.com", [Validators.required]],
    password: ["Nemtom10", [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set("");

    this.http
      .post<LoginResponse>(
        "http://localhost:3000/api/v1/auth/login",
        this.form.getRawValue(),
      )
      .subscribe({
        next: (response) => {
          this.auth.login(
            response.accessToken,
            response.refreshToken,
            response.user,
          );
          this.tenants.setWorkspaces(response.user.memberships);
          void this.router.navigateByUrl(
            this.route.snapshot.queryParamMap.get("returnUrl") ?? "/dashboard",
          );
        },
        error: () => {
          this.error.set(
            "Login failed. Check API, MongoDB, seed data, email and password.",
          );
          this.loading.set(false);
        },
      });
  }
}
