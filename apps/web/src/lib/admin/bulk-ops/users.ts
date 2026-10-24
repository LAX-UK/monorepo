import { adminBulkUsersResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";
import { ADMIN_SUSPEND_REASON_MIN } from "@auction/validators";

export function getUserBulkOperations(): BulkOperation[] {
  return [
    {
      id: "suspend",
      label: "Suspend",
      destructive: true,
      reasonPrompt: {
        title: "Suspend the selected users?",
        description:
          "They are blocked from signing in. The reason is kept in the audit log for each account.",
        fieldLabel: "Reason for the suspension (required)",
        placeholder: "Why these accounts are being suspended…",
        actionLabel: "Suspend",
        minLength: ADMIN_SUSPEND_REASON_MIN,
      },
      run: (ids, options) =>
        adminBulkUsersResultAction({
          ids,
          op: "suspend",
          reason: options?.reason ?? "",
        }),
    },
    {
      id: "unsuspend",
      label: "Unsuspend",
      run: (ids) => adminBulkUsersResultAction({ ids, op: "unsuspend" }),
    },
  ];
}
