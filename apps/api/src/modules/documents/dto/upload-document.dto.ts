import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart fields arrive as strings, so `tags` is accepted comma separated. */
export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : ''))
  @IsString()
  tags?: string;
}
