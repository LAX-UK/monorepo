import { adminBulkUsersResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";

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
