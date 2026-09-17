import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DOCUMENT_KINDS } from '../schemas/document.schema';

export class ListDocumentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  /** `root` for the workspace root, a folder id for a folder, omitted to search every folder. */
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsIn(DOCUMENT_KINDS as unknown as string[])
  kind?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
