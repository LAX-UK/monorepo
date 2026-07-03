export interface IUploadObjectReader {
  /** Returns upload status when the object exists, otherwise null. */
  getStatus(uploadObjectId: string): Promise<string | null>;
  findKey(uploadObjectId: string): Promise<string | null>;
}
