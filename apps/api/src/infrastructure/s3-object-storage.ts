import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
    return { url: `${this.publicBaseUrl}/${key}` };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
