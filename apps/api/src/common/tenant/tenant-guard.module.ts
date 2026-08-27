import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../../modules/tenants/schemas/tenant.schema';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema }
    ])
  ],
  providers: [TenantGuard],
  exports: [TenantGuard, MongooseModule]
})
export class TenantGuardModule {}
