import type { ItemSubmission } from "@auction/types";

/** While specialists review and sell the work, the seller's own documents can be added. */
const UPLOAD_STATUSES = new Set<ItemSubmission["status"]>([
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "converted",
]);

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
