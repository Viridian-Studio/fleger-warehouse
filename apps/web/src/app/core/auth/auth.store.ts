import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  sub: string;
  username: string;
  email: string;
  platformAdmin: boolean;
  superAdmin?: boolean;
  memberships: Array<{
    tenantId: string;
    tenantSlug: string;
    status: string;
    permissions: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly user = signal<AuthUser | null>(this.readUser());
  readonly accessToken = signal<string | null>(localStorage.getItem('accessToken'));
  readonly refreshToken = signal<string | null>(localStorage.getItem('refreshToken'));

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

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
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
