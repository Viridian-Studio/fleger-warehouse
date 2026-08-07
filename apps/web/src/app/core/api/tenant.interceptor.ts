import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { TenantStore } from '../tenant/tenant.store';

export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantStore).activeWorkspace();
  const token = inject(AuthStore).accessToken();

  return next(
    request.clone({
      setHeaders: {
        ...(tenant ? { 'X-Tenant-Slug': tenant.tenantSlug } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  );
};
