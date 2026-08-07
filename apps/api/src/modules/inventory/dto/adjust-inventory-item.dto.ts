import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdjustInventoryItemDto {
  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
