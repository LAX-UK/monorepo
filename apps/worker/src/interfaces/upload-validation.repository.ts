export type UploadValidationRow = {
  id: string;
  key: string;
  status: string;
  kind: string;
  declaredContentType: string;
  declaredByteSize: number;
};

export type ObjectHead = {
  contentType: string;
  byteSize: number;
};

export interface IUploadValidationRepository {
  findUploadedById(uploadId: string): Promise<UploadValidationRow | null>;
  rejectUpload(uploadId: string, reason: string, head?: ObjectHead): Promise<void>;
  activateUpload(uploadId: string, head: ObjectHead): Promise<void>;
  findExpiredPending(now: Date): Promise<Array<{ id: string; key: string }>>;
  /** Enquiry files past their 24 hours that no enquiry holds, whatever state they reached. */
  findExpiredUnsentEnquiryUploads(now: Date): Promise<Array<{ id: string; key: string }>>;
  deleteById(uploadId: string): Promise<void>;
}
