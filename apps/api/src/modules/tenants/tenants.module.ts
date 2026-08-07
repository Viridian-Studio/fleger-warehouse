import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsController } from './tenants.controller';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantMembership, TenantMembershipSchema } from './schemas/membership.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: TenantMembership.name, schema: TenantMembershipSchema }
    ])
  ],
  controllers: [TenantsController],
  exports: [MongooseModule]
})
export class TenantsModule {}
