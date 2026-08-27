import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assignment, AssignmentSchema } from '../assignments/schemas/assignment.schema';
import { VehicleAssignment, VehicleAssignmentSchema } from '../assignments/schemas/vehicle-assignment.schema';
import { AuditLog, AuditLogSchema } from '../audit-log/schemas/audit-log.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { InventoryTransaction, InventoryTransactionSchema } from '../inventory/schemas/inventory-transaction.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Assignment.name, schema: AssignmentSchema },
      { name: VehicleAssignment.name, schema: VehicleAssignmentSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema }
    ])
  ],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
