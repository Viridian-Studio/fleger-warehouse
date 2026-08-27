import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleFuelLogDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  date!: string;

  @IsNumber()
  @Min(0)
  mileage!: number;

  @IsNumber()
  @Min(0.01)
  liters!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
