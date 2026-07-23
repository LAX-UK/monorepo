import { adminBulkSubmissionsResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";

export function getSubmissionBulkOperations(): BulkOperation[] {
  return [
    {
      id: "approve",
      label: "Accept for cataloguing",
      confirm:
        "Accept selected submissions for cataloguing? Draft lots are created separately on each submission's decision tab.",
      run: (ids) =>
        adminBulkSubmissionsResultAction({
          ids,
          op: "approve",
          reviewNotes: "Bulk accepted from admin table",
        }),
    },
    {
      id: "reject",
      label: "Reject",
      destructive: true,
      reasonPrompt: {
        title: "Reject selected submissions",
        description: "This reason is shown to sellers.",
        fieldLabel: "Rejection reason (required)",
        placeholder: "Reason for rejection…",
        actionLabel: "Reject",
        minLength: 10,
      },
      run: (ids, options) =>
        adminBulkSubmissionsResultAction({
          ids,
          op: "reject",
          reason: options?.reason,
          reviewNotes: "Bulk rejected from admin table",
        }),
    },
  ];
}
