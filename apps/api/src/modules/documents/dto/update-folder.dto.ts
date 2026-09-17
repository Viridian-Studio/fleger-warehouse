import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  /** `root` moves the folder to the top level. */
  @IsOptional()
  @IsString()
  parentId?: string;
}
