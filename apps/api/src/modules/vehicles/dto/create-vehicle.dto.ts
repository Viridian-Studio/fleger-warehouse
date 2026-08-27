import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsString()
  manufacturer!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'other'])
  fuelType?: string;

  @IsOptional()
  @IsString()
  registrationDate?: string;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsNumber()
  currentMileage?: number;

  @IsOptional()
  @IsNumber()
  nextServiceMileage?: number;

  @IsOptional()
  @IsString()
  inspectionExpiry?: string;

  @IsOptional()
  @IsString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'ASSIGNED', 'SERVICE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
