import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width?: number;
  height?: number;
}

type SharpModule = typeof import('sharp');

/**
 * Photographed documents come straight off a phone camera and are routinely
 * 4-8 MB. Storing them untouched fills the database fast, so every image is
 * downscaled and re-encoded on upload, and a small thumbnail is kept beside it
 * so the document list never downloads full-size pictures.
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);
  private sharpModule: SharpModule | null | undefined;

  constructor(private readonly config: ConfigService) {}

  /** Longest edge of the stored image, in pixels. */
  get maxEdge(): number {
    return this.config.get<number>('IMAGE_MAX_EDGE') ?? 2400;
  }

  get quality(): number {
    return this.config.get<number>('IMAGE_QUALITY') ?? 82;
  }

  get thumbnailEdge(): number {
    return this.config.get<number>('IMAGE_THUMBNAIL_EDGE') ?? 400;
  }

  /**
   * Returns a smaller version of the image, or null when it cannot be
   * processed (an exotic format, or sharp missing) — the caller then keeps the
   * original bytes.
   */
  async optimize(buffer: Buffer): Promise<ProcessedImage | null> {
    const sharp = await this.load();
    if (!sharp) return null;

    try {
      const output = await this.pipeline(sharp, buffer, this.maxEdge)
        // 4:4:4 keeps thin letter strokes intact, which text recognition needs.
        .jpeg({ quality: this.quality, progressive: true, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();

      const finalMeta = await sharp(output).metadata();
      return {
        buffer: output,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        width: finalMeta.width,
        height: finalMeta.height
      };
    } catch (error) {
      this.logger.warn(`Image optimisation skipped: ${String(error)}`);
      return null;
    }
  }

  /** Small WebP preview for list rows. Null when it cannot be produced. */
  async thumbnail(buffer: Buffer): Promise<ProcessedImage | null> {
    const sharp = await this.load();
    if (!sharp) return null;

    try {
      const output = await this.pipeline(sharp, buffer, this.thumbnailEdge)
        .webp({ quality: 70 })
        .toBuffer();
      return { buffer: output, mimeType: 'image/webp', extension: 'webp' };
    } catch (error) {
      this.logger.warn(`Thumbnail generation skipped: ${String(error)}`);
      return null;
    }
  }

  /**
   * Shared decode step: honour the camera's rotation tag, put transparent
   * pixels on white — a document has no use for an alpha channel, and leaving
   * it in turns the page black in previews and in text recognition — and
   * shrink to fit, never enlarging a picture that is already small.
   */
  private pipeline(sharp: SharpModule, buffer: Buffer, edge: number) {
    return sharp(buffer, { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
  }

  private async load(): Promise<SharpModule | null> {
    if (this.sharpModule !== undefined) return this.sharpModule;
    try {
      this.sharpModule = (await import('sharp')).default as SharpModule;
    } catch (error) {
      this.logger.error(`sharp is unavailable, images are stored as uploaded: ${String(error)}`);
      this.sharpModule = null;
    }
    return this.sharpModule;
  }
}
