import type { Database } from "@auction/db";

export type SourceOfFundsDocumentReviewStatus = "pending" | "superseded";

export type SourceOfFundsDocumentRow = {
  id: string;
  sourceOfFundsId: string;
  uploadObjectId: string;
  requestedType: string;
  label: string | null;
  reviewStatus: SourceOfFundsDocumentReviewStatus | string;
  retentionClass: string;
  uploadedByUserId: string;
  uploadedAt: Date;
  supersededAt: Date | null;
  anonymizedAt: Date | null;
  /** Populated on buyer/admin reads when joined with upload_object. */
  fileName?: string | null;
};

export interface ISourceOfFundsDocumentRepository {
  attach(
    input: {
      sourceOfFundsId: string;
      uploadObjectId: string;
      requestedType: string;
      label: string | null;
      uploadedByUserId: string;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentRow>;
  supersedeActiveForType(
    sourceOfFundsId: string,
    requestedType: string,
    conn?: Database,
  ): Promise<string[]>;
  listForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentRow[]>;
  listActiveForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentRow[]>;
  findById(documentId: string, conn?: Database): Promise<SourceOfFundsDocumentRow | null>;
  countActiveForCase(sourceOfFundsId: string, conn?: Database): Promise<number>;
}
