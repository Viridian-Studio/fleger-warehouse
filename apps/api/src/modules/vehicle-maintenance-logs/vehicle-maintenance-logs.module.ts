import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VehicleMaintenanceLogsController } from './vehicle-maintenance-logs.controller';
import { VehicleMaintenanceLogsService } from './vehicle-maintenance-logs.service';
import { VehicleMaintenanceLog, VehicleMaintenanceLogSchema } from './schemas/vehicle-maintenance-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: VehicleMaintenanceLog.name, schema: VehicleMaintenanceLogSchema }])],
  controllers: [VehicleMaintenanceLogsController],
  providers: [VehicleMaintenanceLogsService],
  exports: [VehicleMaintenanceLogsService]
})
export class VehicleMaintenanceLogsModule {}
