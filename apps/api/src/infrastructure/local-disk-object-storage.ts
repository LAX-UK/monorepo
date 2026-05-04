import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
    return { url: this.getPublicUrl(key) };
  }

  getPublicUrl(key: string): string {
    const base = this.publicUrlPrefix.replace(/\/$/, "");
    const path = key.startsWith("/") ? key : `/${key}`;
    return `${base}${path}`;
  }

  extractKey(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!hasUrlScheme(trimmed)) return trimmed.replace(/^\/+/, "");
    const base = this.publicUrlPrefix.replace(/\/$/, "");
    const prefix = `${base}/`;
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
    return null;
  }

  async createPresignedPut(args: {
    key: string;
    contentType: string;
    byteSize: number;
    expiresInSec: number;
  }): Promise<{ url: string; requiredHeaders: Record<string, string> }> {
    void args.byteSize;
    void args.expiresInSec;
    const apiBase = this.publicUrlPrefix.replace(/\/static\/uploads\/?$/, "");
    const token = Buffer.from(args.key, "utf8").toString("base64url");
    return {
      url: `${apiBase}/uploads/local/${token}`,
      requiredHeaders: {
        "content-type": args.contentType,
      },
    };
  }

  async createPresignedGet(args: { key: string; expiresInSec: number }): Promise<{ url: string }> {
    void args.expiresInSec;
    return { url: this.getPublicUrl(args.key) };
  }

  async headObject(
    key: string,
  ): Promise<{ contentType: string; byteSize: number; etag: string } | null> {
    try {
      const fullPath = join(this.rootDir, key);
      const info = await stat(fullPath);
      return {
        contentType: "application/octet-stream",
        byteSize: info.size,
        etag: `${info.size}-${Math.floor(info.mtimeMs)}`,
      };
    } catch {
      return null;
    }
  }

  async getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null> {
    try {
      const fullPath = join(this.rootDir, key);
      const bytes = await readFile(fullPath);
      return bytes.subarray(0, maxBytes);
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    const fullPath = join(this.rootDir, key);
    await unlink(fullPath).catch(() => undefined);
  }
}

function hasUrlScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}
