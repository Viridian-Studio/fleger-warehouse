import { IsOptional, IsString } from 'class-validator';

export class CreateInventoryCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  active?: boolean;
}
