import type { ReviewLegalEntityDocumentInput } from "@auction/validators";

export type LegalEntityDocumentAdminRow = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  uploadedAt: Date;
  uploadedByUserId: string;
  key: string;
  actualContentType: string | null;
  actualByteSize: number | null;
};

export interface ILegalEntityDocumentAdminRepository {
  findEntityKind(entityId: string): Promise<string | null>;
  listDocumentRows(entityId: string): Promise<LegalEntityDocumentAdminRow[]>;
  reviewDocument(
    documentId: string,
    reviewerUserId: string,
    input: ReviewLegalEntityDocumentInput,
  ): Promise<void>;
  documentExists(entityId: string, documentId: string): Promise<boolean>;
}
