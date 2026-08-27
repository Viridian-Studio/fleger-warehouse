import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { Vehicle, VehicleSchema } from '../vehicles/schemas/vehicle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Vehicle.name, schema: VehicleSchema }
    ])
  ],
  controllers: [SearchController],
  providers: [SearchService]
})
export class SearchModule {}
