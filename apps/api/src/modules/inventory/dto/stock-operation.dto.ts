import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockOperationDto {
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
