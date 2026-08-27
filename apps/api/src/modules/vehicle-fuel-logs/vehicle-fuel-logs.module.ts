import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VehicleFuelLogsController } from './vehicle-fuel-logs.controller';
import { VehicleFuelLogsService } from './vehicle-fuel-logs.service';
import { VehicleFuelLog, VehicleFuelLogSchema } from './schemas/vehicle-fuel-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: VehicleFuelLog.name, schema: VehicleFuelLogSchema }])],
  controllers: [VehicleFuelLogsController],
  providers: [VehicleFuelLogsService],
  exports: [VehicleFuelLogsService]
})
export class VehicleFuelLogsModule {}
