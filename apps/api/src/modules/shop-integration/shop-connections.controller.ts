import { Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { ShopConnectionsService } from './shop-connections.service';

/**
 * Tenant-facing settings for connecting a shop (e.g. Viridian Commerce) to
 * this warehouse: generate/revoke the API key the shop uses to authenticate.
 */
@ApiTags('shop-connections')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'shop-connections', version: '1' })
export class ShopConnectionsController {
  constructor(private readonly service: ShopConnectionsService) {}

  @RequirePermissions('settings.read')
  @Get()
  status(@Req() request: { tenantContext: TenantContext }) {
    return this.service.status(request.tenantContext.tenantId);
  }

  @RequirePermissions('settings.manage')
  @Post('generate')
  generate(@Req() request: { tenantContext: TenantContext }) {
    return this.service.generate(request.tenantContext.tenantId);
  }

  @RequirePermissions('settings.manage')
  @Delete()
  revoke(@Req() request: { tenantContext: TenantContext }) {
    return this.service.revoke(request.tenantContext.tenantId);
  }
}
