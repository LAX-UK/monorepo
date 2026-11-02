import { S3ObjectStorage } from "@auction/object-storage";
import type { ObjectStoragePort } from "@auction/object-storage";
import type { SubjectExportReadSigner } from "../services/subject-export.ports.js";

/** A file name that is safe inside a Content-Disposition header, whatever the worker reported. */
export function safeDownloadFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "lax-data.zip";
}

/**
 * Signs reads for the personal-export bucket and nothing else. Identity's credentials for that
 * bucket allow reads only; the worker is the only party that writes or deletes there. Each link
 * is a GET for one object that downloads as an attachment, and lasts only as long as asked.
 */
export class S3SubjectExportReadSigner implements SubjectExportReadSigner {
  constructor(private readonly storage: Pick<ObjectStoragePort, "createPresignedGet">) {}

  async signDownload(input: {
    objectKey: string;
    fileName: string;
    expiresInSec: number;
    now: Date;
  }): Promise<{ url: string; expiresAt: Date }> {
    const { url } = await this.storage.createPresignedGet({
      key: input.objectKey,
      expiresInSec: input.expiresInSec,
      signingDate: input.now,
      responseContentDisposition: `attachment; filename="${safeDownloadFileName(input.fileName)}"`,
      responseContentType: "application/zip",
    });
    return { url, expiresAt: new Date(input.now.getTime() + input.expiresInSec * 1_000) };
  }
}

export type SubjectExportBucketConfig = {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
};

/** The signer for the configured export bucket, or null when none is configured. */
export function createSubjectExportReadSigner(
  config: SubjectExportBucketConfig | null,
): SubjectExportReadSigner | null {
  if (!config) return null;
  return new S3SubjectExportReadSigner(
    new S3ObjectStorage({
      ...config,
      // Never used: personal exports have no public URL.
      publicBaseUrl: "https://invalid.invalid",
    }),
  );
}
