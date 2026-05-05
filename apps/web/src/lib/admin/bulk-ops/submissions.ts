import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { adminBulkSubmissionsResultAction } from "@/lib/actions/admin";

export function getSubmissionBulkOperations(): BulkOperation[] {
  return [
    {
      id: "approve",
      label: "Approve",
      confirm: "Approve selected submissions? Each approval creates a draft lot.",
      run: (ids) =>
        adminBulkSubmissionsResultAction({
          ids,
          op: "approve",
          reviewNotes: "Bulk approved from admin table",
        }),
    },
    {
      id: "reject",
      label: "Reject",
      destructive: true,
      confirm: "Reject selected submissions?",
      run: (ids) =>
        adminBulkSubmissionsResultAction({
          ids,
          op: "reject",
          reason: "Rejected in bulk by admin",
          reviewNotes: "Bulk rejected from admin table",
        }),
    },
  ];
}
