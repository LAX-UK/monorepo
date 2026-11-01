import type { ItemSubmission } from "@auction/types";

/** While specialists review and sell the work, the seller's own documents can be added. */
const UPLOAD_STATUSES = new Set<ItemSubmission["status"]>([
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "converted",
]);

const IN_REVIEW = new Set<ItemSubmission["status"]>([
  "submitted",
  "under_review",
  "changes_requested",
]);

/**
 * What the seller's documents are for at this stage, said once under the heading: while the work
 * is reviewed they help the specialist decide; once it is taken on they help sell it. Someone who
 * cannot add documents reads what the list is.
 */
export function sellerDocumentsPurpose(
  status: ItemSubmission["status"],
  canManage: boolean,
): string {
  if (!canManage) return "Documents sent with this work.";
  return IN_REVIEW.has(status)
    ? "Certificates, invoices or condition reports that help your specialist review the work."
    : "Anything that helps us sell the work, such as a certificate, provenance or a past invoice.";
}

/**
 * Whether the seller's documents panel has anything to show: a place to add documents, the
 * documents themselves, or why they could not be read.
 */
export function sellerDocumentsPanelShows(input: {
  status: ItemSubmission["status"];
  canManage: boolean;
  failed: boolean;
  count: number;
}): boolean {
  if (!UPLOAD_STATUSES.has(input.status)) return false;
  // Someone who may not add documents has nothing to do here until there is one to read.
  return input.canManage || input.failed || input.count > 0;
}
