export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  permissions: string[];
  platformAdmin: boolean;
}

export const TENANT_CONTEXT = Symbol('TENANT_CONTEXT');
