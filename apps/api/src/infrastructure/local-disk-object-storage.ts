import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";

export class LocalDiskObjectStorage implements IObjectStorage {
  constructor(
    private readonly rootDir: string,
    private readonly publicUrlPrefix: string,
  ) {}

  async putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    void contentType;
    const fullPath = join(this.rootDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body);
    const base = this.publicUrlPrefix.replace(/\/$/, "");
    const path = key.startsWith("/") ? key : `/${key}`;
    return { url: `${base}${path}` };
  }

  async deleteObject(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    const fullPath = join(this.rootDir, key);
    await unlink(fullPath).catch(() => undefined);
  }
}
