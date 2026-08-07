import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleAssignmentDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  employeeId!: string;

  @IsNumber()
  @Min(0)
  mileageAtAssignment!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
