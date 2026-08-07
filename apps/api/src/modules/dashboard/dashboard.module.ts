import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Assignment.name, schema: AssignmentSchema }
    ])
  ],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
