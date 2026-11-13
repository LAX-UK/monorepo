export interface IUploadObjectReader {
  /** Returns upload status when the object exists, otherwise null. */
  getStatus(uploadObjectId: string): Promise<string | null>;
  findKey(uploadObjectId: string): Promise<string | null>;
}

/** What an upload is, as validated: who sent it, of what kind, and what it turned out to be. */
export type UploadObjectDescription = {
  status: string;
  kind: string;
  ownerUserId: string | null;
  /** The validated type and size once checked; the declared ones before. */
  contentType: string;
  byteSize: number;
};

export interface IUploadObjectDescriber {
  describe(uploadObjectId: string): Promise<UploadObjectDescription | null>;
}
