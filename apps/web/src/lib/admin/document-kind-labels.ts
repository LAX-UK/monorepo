import type { lotDocumentKinds, saleDocumentKinds, submissionDocumentKinds } from "@auction/types";

const SALE_KIND_LABELS: Record<(typeof saleDocumentKinds)[number], string> = {
  terms: "Terms of sale (PDF)",
  catalog: "Sale catalogue",
  other: "Other document",
};

const LOT_KIND_LABELS: Record<(typeof lotDocumentKinds)[number], string> = {
  condition_report: "Condition report",
  provenance: "Provenance",
  authentication: "Authentication",
  valuation: "Valuation",
  other: "Other document",
};

const SUBMISSION_KIND_LABELS: Record<(typeof submissionDocumentKinds)[number], string> = {
  provenance: "Provenance",
  valuation: "Valuation",
  correspondence: "Correspondence",
  other: "Other document",
};

const ALL_KIND_LABELS: Record<string, string> = {
  ...SALE_KIND_LABELS,
  ...LOT_KIND_LABELS,
  ...SUBMISSION_KIND_LABELS,
};

/** Staff-facing label for a document `kind` enum value. Falls back to title-cased kind. */
export function documentKindLabel(kind: string): string {
  const mapped = ALL_KIND_LABELS[kind];
  if (mapped) return mapped;
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Accepted file types helper for document upload areas (matches upload policy). */
export const DOCUMENT_UPLOAD_HELPER = "PDF or image · max 25 MB";
