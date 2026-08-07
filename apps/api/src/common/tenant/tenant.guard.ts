import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantSlug = request.headers['x-tenant-slug'];

    if (!request.user) {
      throw new ForbiddenException('Authenticated user is required');
    }

    if (!tenantSlug || Array.isArray(tenantSlug)) {
      throw new ForbiddenException('X-Tenant-Slug header is required');
    }

    const membership = request.user.memberships?.find(
      (item: { tenantSlug: string; status: string }) =>
        item.tenantSlug === tenantSlug && item.status === 'ACTIVE'
    );

    if (!membership) {
      throw new ForbiddenException('User is not an active member of this tenant');
    }

    request.tenantContext = {
      tenantId: membership.tenantId,
      tenantSlug,
      userId: request.user.sub,
      permissions: membership.permissions,
      platformAdmin: request.user.platformAdmin === true
    };

    return true;
  }
}
