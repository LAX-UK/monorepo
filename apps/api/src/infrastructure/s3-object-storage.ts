import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";

export type S3ObjectStorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base URL returned to clients (no trailing slash). */
  publicBaseUrl: string;
};

export class S3ObjectStorage implements IObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(cfg: S3ObjectStorageConfig) {
    this.bucket = cfg.bucket;
    this.publicBaseUrl = cfg.publicBaseUrl.replace(/\/$/, "");
    this.client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { url: this.getPublicUrl(key) };
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async createPresignedPut(args: {
    key: string;
    contentType: string;
    byteSize: number;
    expiresInSec: number;
  }): Promise<{ url: string; requiredHeaders: Record<string, string> }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: args.key,
      ContentType: args.contentType,
      ContentLength: args.byteSize,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: args.expiresInSec });
    return {
      url,
      requiredHeaders: {
        "content-type": args.contentType,
      },
    };
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

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("name" in err || "$metadata" in err) &&
    ((err as { name?: string }).name === "NotFound" ||
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
  );
}
