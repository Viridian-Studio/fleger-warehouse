import { Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @RequirePermissions('settings.read')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.notifications.list(request.tenantContext);
  }

  @RequirePermissions('settings.read')
  @Get('unread')
  unread(@Req() request: { tenantContext: TenantContext }) {
    return this.notifications.unread(request.tenantContext);
  }

  @RequirePermissions('settings.read')
  @Patch(':id/read')
  markRead(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.notifications.markRead(request.tenantContext, id);
  }

  @RequirePermissions('settings.read')
  @Delete(':id')
  remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    return this.notifications.remove(request.tenantContext, id);
  }
}
