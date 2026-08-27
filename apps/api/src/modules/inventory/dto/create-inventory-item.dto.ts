import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';



export class CreateInventoryItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  inventoryNumber?: string;

  @IsIn(['QUANTITY', 'ASSET'])
  type!: 'QUANTITY' | 'ASSET';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsIn(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'SCRAPPED'])
  status?: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'LOST' | 'SCRAPPED';

  @IsOptional()
  @IsString()
  notes?: string;
}
