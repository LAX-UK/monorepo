import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { adminBulkEmailSuppressionsResultAction } from "@/lib/actions/admin";

export function getEmailSuppressionBulkOperations(): BulkOperation[] {
  return [
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      confirm: "Delete selected email suppressions?",
      run: (emailHashes) =>
        adminBulkEmailSuppressionsResultAction({
          emailHashes,
          op: "delete",
        }),
    },
  ];
}
