import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantContext } from '../../common/tenant/tenant-context';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { Role } from './schemas/role.schema';

class CreateRoleDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @IsOptional()
  @IsBoolean()
  systemRole?: boolean;
}

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(@InjectModel(Role.name) private readonly roles: Model<Role>) {}

  @RequirePermissions('role.manage')
  @Get()
  list(@Req() request: { tenantContext: TenantContext }) {
    return this.roles.find({ tenantId: request.tenantContext.tenantId }).sort({ systemRole: -1, name: 1 });
  }

  @RequirePermissions('role.manage')
  @Post()
  create(@Req() request: { tenantContext: TenantContext }, @Body() dto: CreateRoleDto) {
    return this.roles.create({
      tenantId: request.tenantContext.tenantId,
      name: dto.name,
      permissions: dto.permissions,
      systemRole: dto.systemRole ?? false
    });
  }

  @RequirePermissions('role.manage')
  @Patch(':id')
  update(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.roles.findOneAndUpdate(
      { _id: id, tenantId: request.tenantContext.tenantId },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
          ...(dto.systemRole !== undefined ? { systemRole: dto.systemRole } : {})
        }
      },
      { new: true }
    );
  }

  @RequirePermissions('role.manage')
  @Delete(':id')
  async remove(@Req() request: { tenantContext: TenantContext }, @Param('id') id: string) {
    const role = await this.roles.findOne({ _id: id, tenantId: request.tenantContext.tenantId });
    if (role?.systemRole) throw new BadRequestException('System roles cannot be deleted');
    return this.roles.findOneAndDelete({ _id: id, tenantId: request.tenantContext.tenantId });
  }
}
