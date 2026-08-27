import { HttpClient, HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }
}

// --- Auth interceptor: handles 401 by refreshing the JWT, then retries ---

let isRefreshing = false;
const refreshed$ = new BehaviorSubject<boolean>(false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);

  // Skip auth endpoints (login, refresh) — never refresh on these
  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 403 with "workspace is no longer active" — tenant was deactivated, force logout
      if (
        error.status === 403 &&
        typeof error.error?.message === 'string' &&
        error.error.message.toLowerCase().includes('workspace is no longer active')
      ) {
        auth.logout();
        return throwError(() => error);
      }

      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      // 401 on a protected endpoint — try refresh
      if (isRefreshing) {
        // Wait for the ongoing refresh to complete, then retry with the new token
        return refreshed$.pipe(
          filter((done) => done),
          take(1),
          switchMap(() => retryWithToken(req, next, auth))
        );
      }

      isRefreshing = true;
      return from(auth.tryRefresh()).pipe(
        switchMap((success) => {
          isRefreshing = false;
          refreshed$.next(success);
          if (!success) {
            return throwError(() => error);
          }
          return retryWithToken(req, next, auth);
        })
      );
    })
  );
};

function retryWithToken(req: HttpRequest<unknown>, next: HttpHandlerFn, auth: AuthStore) {
  const newToken = auth.accessToken();
  if (!newToken) return throwError(() => new Error('No token after refresh'));
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
}
