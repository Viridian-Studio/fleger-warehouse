import { IsIn, IsNumber, IsString, Min } from 'class-validator';

export class CreateInventoryAssignmentDto {
  @IsString()
  itemId!: string;

  @IsIn(['EMPLOYEE', 'VEHICLE'])
  targetType!: 'EMPLOYEE' | 'VEHICLE';

  @IsString()
  targetId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}
