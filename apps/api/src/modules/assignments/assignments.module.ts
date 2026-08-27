import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryModule } from '../inventory/inventory.module';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema';
import { VehicleAssignment, VehicleAssignmentSchema } from './schemas/vehicle-assignment.schema';

@Module({
  imports: [
    InventoryModule,
    EmployeesModule,
    VehiclesModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
      { name: VehicleAssignment.name, schema: VehicleAssignmentSchema }
    ])
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService]
})
export class AssignmentsModule {}
