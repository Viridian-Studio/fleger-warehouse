import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationDetailsController } from './application-details.controller';
import { ApplicationDetailsService } from './application-details.service';
import { ApplicationDetails, ApplicationDetailsSchema } from './schemas/application-details.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ApplicationDetails.name, schema: ApplicationDetailsSchema }])],
  controllers: [ApplicationDetailsController],
  providers: [ApplicationDetailsService]
})
export class ApplicationDetailsModule {}
