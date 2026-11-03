import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SubjectExportReadSigner } from "../services/subject-export.ports.js";

/** A file name that is safe inside a Content-Disposition header, whatever the worker reported. */
export function safeDownloadFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "lax-data.zip";
}

export type SubjectExportBucketConfig = {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Signs reads for the personal-export bucket and nothing else. Identity's credentials for that
 * bucket allow reads only; the worker is the only party that writes or deletes there. Each link
 * is a GET for one object that downloads as an attachment, and lasts only as long as asked.
 */
export class S3SubjectExportReadSigner implements SubjectExportReadSigner {
  private readonly client: S3Client;

  constructor(private readonly config: SubjectExportBucketConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async signDownload(input: {
    objectKey: string;
    fileName: string;
    expiresInSec: number;
    now: Date;
  }): Promise<{ url: string; expiresAt: Date }> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        ResponseContentDisposition: `attachment; filename="${safeDownloadFileName(input.fileName)}"`,
        ResponseContentType: "application/zip",
      }),
      { expiresIn: input.expiresInSec, signingDate: input.now },
    );
    return { url, expiresAt: new Date(input.now.getTime() + input.expiresInSec * 1_000) };
  }
}
