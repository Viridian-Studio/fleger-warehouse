import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type TesseractWorker = {
  recognize(image: Buffer): Promise<{ data: { text: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
};

/**
 * Text recognition for photographed documents.
 *
 * Tesseract is loaded lazily and kept alive in a single worker: the first call
 * pays for the language data download (cached on disk afterwards), later calls
 * are queued behind it so one request cannot starve the others.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private worker: Promise<TesseractWorker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  get languages(): string {
    return this.config.get<string>('OCR_LANGUAGES') ?? 'hun+eng';
  }

  async recognize(image: Buffer): Promise<string> {
    const run = this.queue.then(
      () => this.runRecognition(image),
      () => this.runRecognition(image)
    );
    // Keep the chain alive even when a job fails, otherwise later jobs never run.
    this.queue = run.catch(() => undefined);
    return run;
  }

  async onModuleDestroy() {
    if (!this.worker) return;
    try {
      const worker = await this.worker;
      await worker.terminate();
    } catch {
      // The worker never came up — nothing to clean up.
    }
    this.worker = null;
  }

  private async runRecognition(image: Buffer): Promise<string> {
    const worker = await this.getWorker();
    const result = await worker.recognize(image);
    return (result.data.text ?? '').replace(/\r\n/g, '\n').trim();
  }

  private getWorker(): Promise<TesseractWorker> {
    if (this.worker) return this.worker;

    this.worker = (async () => {
      const cachePath = this.config.get<string>('OCR_CACHE_PATH') ?? join(tmpdir(), 'fleger-ocr');
      const langPath = this.config.get<string>('OCR_LANG_PATH');
      this.logger.log(`Starting OCR worker (languages: ${this.languages})`);

      const tesseract = (await import('tesseract.js')) as unknown as {
        createWorker: (
          langs: string,
          oem?: number,
          options?: Record<string, unknown>
        ) => Promise<TesseractWorker>;
      };

      return tesseract.createWorker(this.languages, 1, {
        cachePath,
        ...(langPath ? { langPath } : {})
      });
    })();

    // A failed start must not poison every later attempt.
    this.worker.catch((error) => {
      this.logger.error(`OCR worker failed to start: ${String(error)}`);
      this.worker = null;
    });

    return this.worker;
  }
}
