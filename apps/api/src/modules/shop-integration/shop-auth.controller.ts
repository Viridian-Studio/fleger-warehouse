import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from '../tenants/schemas/tenant.schema';
import { TenantContext } from '../../common/tenant/tenant-context';
import { ApiKeyGuard } from './api-key.guard';

/**
 * Shop-facing auth check. A connected shop calls this with its API key to
 * verify the connection is still valid and to learn the warehouse's name.
 */
@ApiTags('shop-integration')
@ApiSecurity('shop-api-key')
@Controller({ path: 'auth', version: '1' })
export class ShopAuthController {
  constructor(@InjectModel(Tenant.name) private readonly tenants: Model<TenantDocument>) {}

  @UseGuards(ApiKeyGuard)
  @Get('verify')
  async verify(@Req() request: { tenantContext: TenantContext }) {
    const tenant = await this.tenants.findById(request.tenantContext.tenantId).select('name').lean();
    return { name: tenant?.name };
  }
}
