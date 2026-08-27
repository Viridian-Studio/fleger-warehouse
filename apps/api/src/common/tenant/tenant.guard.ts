import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant } from '../../modules/tenants/schemas/tenant.schema';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantSlug = request.headers['x-tenant-slug'];

    if (!request.user) {
      throw new ForbiddenException('Authenticated user is required');
    }

    if (!tenantSlug || Array.isArray(tenantSlug)) {
      throw new ForbiddenException('X-Tenant-Slug header is required');
    }

    const isSuperAdmin = request.user.superAdmin === true || request.user.platformAdmin === true;

    const membership = request.user.memberships?.find(
      (item: { tenantSlug: string; status: string }) =>
        item.tenantSlug === tenantSlug && item.status === 'ACTIVE'
    );

    // Super admins can access any tenant even without an active membership
    if (!membership && !isSuperAdmin) {
      throw new ForbiddenException('User is not an active member of this tenant');
    }

    // Look up the tenant in the database
    const tenant = await this.tenantModel.findOne({ slug: tenantSlug }).select('status _id').lean() as { status?: string; _id?: Types.ObjectId } | null;

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // Block access if the tenant is not ACTIVE, unless the user is a super admin
    if (tenant.status !== 'ACTIVE' && !isSuperAdmin) {
      throw new ForbiddenException('This workspace is no longer active');
    }

    request.tenantContext = {
      tenantId: membership ? membership.tenantId : String(tenant._id),
      tenantSlug,
      userId: request.user.sub,
      permissions: membership ? membership.permissions : [],
      platformAdmin: request.user.platformAdmin === true
    };

    return true;
  }
}
