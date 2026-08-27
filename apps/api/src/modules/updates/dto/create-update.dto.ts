import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChangeDto {
  @IsIn(['feature', 'improvement', 'fix', 'breaking', 'security'])
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateUpdateDto {
  @IsString()
  buildName!: string;

  @IsString()
  version!: string;

  @IsNumber()
  @Min(1)
  buildNumber!: number;

  @IsDateString()
  releasedAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChangeDto)
  changes!: CreateChangeDto[];
}
