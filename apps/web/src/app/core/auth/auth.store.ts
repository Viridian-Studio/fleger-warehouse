import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  sub: string;
  username: string;
  email: string;
  platformAdmin: boolean;
  superAdmin?: boolean;
  passwordMustChange?: boolean;
  memberships: Array<{
    tenantId: string;
    tenantSlug: string;
    status: string;
    permissions: string[];
  }>;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private refreshing: Promise<boolean> | null = null;

  readonly user = signal<AuthUser | null>(this.readUser());
  readonly accessToken = signal<string | null>(localStorage.getItem('accessToken'));
  readonly refreshToken = signal<string | null>(localStorage.getItem('refreshToken'));

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  isAuthenticated() {
    return Boolean(this.accessToken() && this.user());
  }

  login(accessToken: string, refreshToken: string, user: AuthUser) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('authUser', JSON.stringify(user));
    this.accessToken.set(accessToken);
    this.refreshToken.set(refreshToken);
    this.user.set(user);
  }

  logout(redirect = true) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * Returns true on success, false on failure (and logs out).
   * Deduplicates concurrent refresh attempts.
   */
  async tryRefresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    const rt = this.refreshToken();
    if (!rt) {
      this.logout();
      return false;
    }
    this.refreshing = (async () => {
      try {
        const response = await firstValueFrom(
          this.http.post<RefreshResponse>('http://localhost:3000/api/v1/auth/refresh', { refreshToken: rt })
        );
        this.login(response.accessToken, response.refreshToken, response.user);
        return true;
      } catch {
        this.logout();
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
