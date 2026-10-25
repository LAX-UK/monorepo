import { adminBulkSubmissionsResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";

export function getSubmissionBulkOperations(): BulkOperation[] {
  return [
    {
      id: "approve",
      label: "Accept for cataloguing",
      confirm:
        "Sellers are told their submissions were accepted. Create each draft lot from its decision page.",
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
        description: "Each seller is emailed this reason as written.",
        fieldLabel: "Reason for the sellers",
        placeholder: "",
        actionLabel: "Reject submissions",
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
