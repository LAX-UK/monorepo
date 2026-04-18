/** Pluggable binary object storage (local disk or S3-compatible). */
export interface IObjectStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  deleteObject(key: string): Promise<void>;
}
