export type UploadObjectRow = {
  id: string;
  ownerUserId: string;
  kind: string;
  key: string;
  declaredContentType: string;
  declaredByteSize: number;
  status: string;
  rejectionReason: string | null;
};

export type InsertPendingUploadInput = {
  ownerUserId: string;
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
  markUploaded(uploadId: string, uploadedAt: Date): Promise<void>;
}
