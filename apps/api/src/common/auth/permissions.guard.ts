import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenantContext;

    // Super admins bypass permission checks
    if (tenant?.platformAdmin === true || request.user?.superAdmin === true || request.user?.platformAdmin === true) {
      return true;
    }

    const hasPermission = required.every((permission) => tenant?.permissions?.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException('Missing required tenant permission');
    }

    return true;
  }
}
