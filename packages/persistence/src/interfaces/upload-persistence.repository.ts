/** Who an upload belongs to: a signed-in person, or the enquiry draft a visitor uploaded it for. */
export type UploadOwner =
  | { ownerUserId: string; enquiryDraftId?: undefined }
  | { enquiryDraftId: string; ownerUserId?: undefined };

export type UploadObjectRow = {
  id: string;
  ownerUserId: string | null;
  enquiryDraftId: string | null;
  kind: string;
  key: string;
  declaredContentType: string;
  declaredByteSize: number;
  status: string;
  rejectionReason: string | null;
};

export type InsertPendingUploadInput = UploadOwner & {
  kind: string;
  key: string;
  declaredContentType: string;
  declaredByteSize: number;
  expiresAt: Date;
};

export interface IUploadPersistenceRepository {
  insertPending(input: InsertPendingUploadInput): Promise<{ id: string } | null>;
  findById(uploadId: string): Promise<UploadObjectRow | null>;
  findByIdForOwner(uploadId: string, ownerUserId: string): Promise<UploadObjectRow | null>;
  findByIdForDraft(uploadId: string, enquiryDraftId: string): Promise<UploadObjectRow | null>;
  markUploaded(uploadId: string, uploadedAt: Date): Promise<void>;
  /**
   * How many enquiry files the owner has uploaded and not yet sent with an enquiry. Files past
   * their expiry are not counted: the clean-up is about to remove them.
   */
  countUnsentEnquiryUploads(owner: UploadOwner, now: Date): Promise<number>;
}
