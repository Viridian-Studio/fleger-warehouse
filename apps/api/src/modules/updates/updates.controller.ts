import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { UpdatesService } from './updates.service';
import { CreateUpdateDto } from './dto/create-update.dto';

@ApiTags('updates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'updates', version: '1' })
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @RequirePermissions('updates.read')
  @Get()
  list() {
    return this.updates.list();
  }

  @RequirePermissions('updates.read')
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.updates.detail(id);
  }

  @RequirePermissions('updates.manage')
  @Post()
  create(@Body() dto: CreateUpdateDto) {
    return this.updates.create(dto);
  }

  @RequirePermissions('updates.manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.updates.remove(id);
  }
}
