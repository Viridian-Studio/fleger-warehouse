import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  licensePlate!: string;

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
  @IsNumber()
  currentMileage?: number;

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
