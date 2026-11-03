import type { SubjectExportFileRef } from "@auction/identity-contracts";
import type { ObjectStoragePort } from "@auction/object-storage";

/**
 * How long a signed file link lasts. The worker fetches each file straight after it reads the page
 * that names it, so minutes are enough; the link is never stored.
 */
export const SUBJECT_EXPORT_FILE_LINK_SECONDS = 900;

export type SignableFile = {
  /** A storage key, or a stored URL that belongs to this storage backend. */
  keyOrUrl: string;
  fileName: string;
  contentType?: string | null;
  byteSize?: number | null;
};

/** Hands out short-lived signed links from Shop's own storage; file bytes never travel in a page. */
export class SubjectExportFileSigner {
  constructor(
    private readonly storage: Pick<ObjectStoragePort, "createPresignedGet" | "extractKey">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Null when the value does not point at an object in Shop's storage. */
  async sign(file: SignableFile): Promise<SubjectExportFileRef | null> {
    const key = this.storage.extractKey(file.keyOrUrl) ?? this.asBareKey(file.keyOrUrl);
    if (!key) return null;
    const safeName = file.fileName.replace(/[^\w.\- ]+/g, "_");
    const { url } = await this.storage.createPresignedGet({
      key,
      expiresInSec: SUBJECT_EXPORT_FILE_LINK_SECONDS,
      responseContentDisposition: `attachment; filename="${safeName}"`,
    });
    return {
      url,
      fileName: file.fileName,
      contentType: file.contentType ?? null,
      byteSize: file.byteSize ?? null,
      expiresAt: new Date(
        this.now().getTime() + SUBJECT_EXPORT_FILE_LINK_SECONDS * 1000,
      ).toISOString(),
    };
  }

  async signAll(files: readonly SignableFile[]): Promise<SubjectExportFileRef[]> {
    const signed = await Promise.all(files.map((file) => this.sign(file)));
    return signed.filter((ref): ref is SubjectExportFileRef => ref !== null);
  }

  private asBareKey(value: string): string | null {
    return /^[\w\-./]+$/.test(value) && !/^[a-z]+:\/\//i.test(value) ? value : null;
  }
}

/**
 * Stands in when object storage is not configured. A record that names a file then fails the page
 * (the caller answers 503 and retries) instead of shipping the record without its file.
 */
export const unconfiguredSubjectExportStorage: Pick<
  ObjectStoragePort,
  "createPresignedGet" | "extractKey"
> = {
  extractKey: () => null,
  createPresignedGet: async () => {
    throw new Error("object_storage_not_configured");
  },
};
