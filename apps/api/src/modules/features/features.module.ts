import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantFeature, TenantFeatureSchema } from './schemas/tenant-feature.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: TenantFeature.name, schema: TenantFeatureSchema }])],
  exports: [MongooseModule]
})
export class FeaturesModule {}
