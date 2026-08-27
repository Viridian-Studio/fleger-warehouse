import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleMaintenanceLogDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  date!: string;

  @IsNumber()
  @Min(0)
  mileageAtService!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsIn(['oil', 'tire', 'inspection', 'repair', 'other'])
  type!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
