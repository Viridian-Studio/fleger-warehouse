import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Tenant } from '../tenants/schemas/tenant.schema';

class CreateTenantDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  planCode?: string;
}

class UpdateTenantStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED'])
  status!: string;
}

class UpdateTenantPlanDto {
  @IsString()
  planCode!: string;
}

@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform-admin', version: '1' })
export class PlatformAdminController {
  constructor(@InjectModel(Tenant.name) private readonly tenants: Model<Tenant>) {}

  @Get('tenants')
  listTenants(@Req() request: { user: { platformAdmin?: boolean; superAdmin?: boolean } }) {
    assertPlatformAdmin(request);
    return this.tenants.find().sort({ name: 1 });
  }

  @Post('tenants')
  async createTenant(@Req() request: { user: { platformAdmin?: boolean; superAdmin?: boolean } }, @Body() dto: CreateTenantDto) {
    assertPlatformAdmin(request);
    const slug = dto.slug?.trim() ? slugify(dto.slug!) : await this.generateUniqueSlug(dto.name);
    return this.tenants.create({
      name: dto.name,
      slug,
      planCode: dto.planCode ?? 'STARTER',
      status: 'ACTIVE',
      settings: {},
      branding: {}
    });
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base || 'tenant';
    let suffix = 1;
    while (await this.tenants.exists({ slug })) {
      slug = `${base || 'tenant'}-${suffix++}`;
    }
    return slug;
  }

  @Patch('tenants/:id/status')
  updateStatus(
    @Req() request: { user: { platformAdmin?: boolean; superAdmin?: boolean } },
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto
  ) {
    assertPlatformAdmin(request);
    return this.tenants.findByIdAndUpdate(id, { $set: { status: dto.status } }, { new: true });
  }

  @Patch('tenants/:id/plan')
  updatePlan(
    @Req() request: { user: { platformAdmin?: boolean; superAdmin?: boolean } },
    @Param('id') id: string,
    @Body() dto: UpdateTenantPlanDto
  ) {
    assertPlatformAdmin(request);
    return this.tenants.findByIdAndUpdate(id, { $set: { planCode: dto.planCode } }, { new: true });
  }

  @Get('tenants/:id/usage')
  async usage(@Req() request: { user: { platformAdmin?: boolean; superAdmin?: boolean } }, @Param('id') id: string) {
    assertPlatformAdmin(request);
    const tenant = await this.tenants.findById(id);
    return {
      tenantId: id,
      planCode: tenant?.planCode,
      status: tenant?.status,
      metrics: {
        users: null,
        inventoryItems: null,
        vehicles: null,
        employees: null
      }
    };
  }
}

function assertPlatformAdmin(request: { user: { platformAdmin?: boolean; superAdmin?: boolean } }) {
  if (!request.user.platformAdmin && !request.user.superAdmin) {
    throw new ForbiddenException('Super admin access required');
  }
}

function slugify(value: string): string {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
