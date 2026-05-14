export const documentEntityKinds = ["lot", "sale", "submission"] as const;
export type DocumentEntityKind = (typeof documentEntityKinds)[number];

export const lotDocumentKinds = [
  "condition_report",
  "provenance",
  "authentication",
  "valuation",
  "other",
] as const;
export type LotDocumentKind = (typeof lotDocumentKinds)[number];

export const saleDocumentKinds = ["terms", "catalog", "other"] as const;
export type SaleDocumentKind = (typeof saleDocumentKinds)[number];

export const submissionDocumentKinds = [
  "provenance",
  "valuation",
  "correspondence",
  "other",
] as const;
export type SubmissionDocumentKind = (typeof submissionDocumentKinds)[number];

/** Staff-facing document row with resolved download URL (API layer). */
export type EntityDocument = {
  id: string;
  entityKind: DocumentEntityKind;
  entityId: string;
  kind: string;
  label: string | null;
  uploadObjectId: string;
  downloadUrl: string;
  fileName: string | null;
  byteSize: number | null;
  contentType: string | null;
  /** Present for sale/submission documents; lot documents have no column yet. */
  createdByUserId: string | null;
  createdAt: Date;
};
