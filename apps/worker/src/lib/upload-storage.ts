import { readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { WorkerEnv } from "../env.js";

export type UploadStorage = {
  headObject(key: string): Promise<{ contentType: string; byteSize: number; etag: string } | null>;
  getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
};

export function createUploadStorage(env: WorkerEnv): UploadStorage {
  if (env.STORAGE_DRIVER === "s3") {
    return new WorkerS3UploadStorage(env);
  }
  return new WorkerLocalUploadStorage(env.STORAGE_LOCAL_ROOT);
}

class WorkerS3UploadStorage implements UploadStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: WorkerEnv) {
    if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 upload storage is missing required env vars");
    }
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async headObject(key: string): Promise<{ contentType: string; byteSize: number; etag: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return {
        contentType: result.ContentType ?? "application/octet-stream",
        byteSize: result.ContentLength ?? 0,
        etag: result.ETag ?? "",
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
        }),
      );
      if (!result.Body) return Buffer.alloc(0);
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

class WorkerLocalUploadStorage implements UploadStorage {
  constructor(private readonly rootDir: string) {}

  async headObject(key: string): Promise<{ contentType: string; byteSize: number; etag: string } | null> {
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
    await unlink(join(this.rootDir, key)).catch(() => undefined);
  }
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("name" in err || "$metadata" in err) &&
    ((err as { name?: string }).name === "NotFound" ||
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
  );
}
