import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReturnVehicleAssignmentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  mileageAtReturn?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
