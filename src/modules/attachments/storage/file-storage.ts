import { mkdir, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";

export class LocalStorage {
  constructor(private readonly basePath: string) {}

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private generateFileName(originalName: string): string {
    const extension = extname(originalName);

    return `${randomUUID()}${extension}`;
  }

  async save(
    stream: NodeJS.ReadableStream,
    originalName: string,
  ): Promise<{
    fileName: string;
    storagePath: string;
  }> {
    await this.ensureDirectory();

    const fileName = this.generateFileName(originalName);
    const storagePath = join(this.basePath, fileName);

    await pipeline(stream, createWriteStream(storagePath));

    return {
      fileName,
      storagePath,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
