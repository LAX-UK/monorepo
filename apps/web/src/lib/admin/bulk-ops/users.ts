import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { adminBulkUsersResultAction } from "@/lib/actions/admin";

export function getUserBulkOperations(): BulkOperation[] {
  return [
    {
      id: "suspend",
      label: "Suspend",
      destructive: true,
      confirm: "Suspend the selected users?",
      run: (ids) =>
        adminBulkUsersResultAction({
          ids,
          op: "suspend",
          reason: "Bulk suspension from admin table",
        }),
    },
    {
      id: "unsuspend",
      label: "Unsuspend",
      run: (ids) => adminBulkUsersResultAction({ ids, op: "unsuspend" }),
    },
  ];
}
