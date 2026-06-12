/** Pluggable binary object storage (local disk or S3-compatible). */
export interface IObjectStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  getPublicUrl(key: string): string;
  createPresignedPut(args: {
    key: string;
    contentType: string;
    byteSize: number;
    expiresInSec: number;
  }): Promise<{ url: string; requiredHeaders: Record<string, string> }>;
  createPresignedGet(args: {
    key: string;
    expiresInSec: number;
    signingDate?: Date | undefined;
  }): Promise<{ url: string }>;
  /** Returns an object key when the value belongs to this storage backend. */
  extractKey(value: string): string | null;
  headObject(key: string): Promise<{ contentType: string; byteSize: number; etag: string } | null>;
  getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
}
