/**
 * "Delete draft" (GAP-53, docs/design/decision-pack-2026-11-17.md section 5): the words, in one
 * place, for the draft's row menu and the draft's page.
 */
export const DELETE_DRAFT_COPY = {
  action: "Delete draft",
  confirmTitle: "Delete this draft?",
  confirmBody: "Its photos and answers are removed. This cannot be undone.",
  confirmLabel: "Delete draft",
  cancel: "Cancel",
  deleting: "Deleting…",
  deleted: "Draft deleted",
  failed: "We couldn't delete the draft. Try again.",
} as const;
