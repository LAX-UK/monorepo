import { createReadStream } from "node:fs";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

/** Where finished copies are kept: a private bucket only the worker writes to. */
export interface SubjectExportArchiveStore {
  uploadFile(key: string, filePath: string, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export type S3ArchiveStoreConfig = {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
};

/** S3 needs every part but the last to be at least 5 MiB; 16 MiB keeps 2 GB well under 10,000 parts. */
export const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

type S3Sender = Pick<S3Client, "send">;

/**
 * The export bucket over S3, written by multipart upload so a 2 GB copy streams from disk without
 * being held in memory, and a failed upload leaves no half-written object (it is aborted).
 */
export class S3MultipartArchiveStore implements SubjectExportArchiveStore {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Sender,
    private readonly partBytes = MULTIPART_PART_BYTES,
  ) {}

  static fromConfig(config: S3ArchiveStoreConfig): S3MultipartArchiveStore {
    return new S3MultipartArchiveStore(
      config.bucket,
      new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
    );
  }

  async uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
    const { UploadId } = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
    if (!UploadId) throw new Error("multipart upload was not started");
    try {
      const parts: { ETag: string; PartNumber: number }[] = [];
      for await (const body of this.parts(filePath)) {
        const partNumber = parts.length + 1;
        const { ETag } = await this.client.send(
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId,
            PartNumber: partNumber,
            Body: body,
          }),
        );
        if (!ETag) throw new Error("multipart part was not acknowledged");
        parts.push({ ETag, PartNumber: partNumber });
      }
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
    } catch (error) {
      await this.client
        .send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId }))
        .catch(() => undefined);
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** The file in fixed-size parts; an empty file is one empty part, which S3 accepts as the last. */
  private async *parts(filePath: string): AsyncGenerator<Buffer> {
    let pending: Buffer[] = [];
    let size = 0;
    let yielded = false;
    for await (const chunk of createReadStream(filePath, { highWaterMark: 1024 * 1024 })) {
      pending.push(chunk as Buffer);
      size += (chunk as Buffer).length;
      if (size >= this.partBytes) {
        let whole = Buffer.concat(pending);
        while (whole.length >= this.partBytes) {
          yield whole.subarray(0, this.partBytes);
          yielded = true;
          whole = whole.subarray(this.partBytes);
        }
        pending = whole.length ? [whole] : [];
        size = whole.length;
      }
    }
    if (size > 0 || !yielded) yield Buffer.concat(pending);
  }
}
