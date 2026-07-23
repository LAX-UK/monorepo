import { adminBulkInvitationsResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";

export function getInvitationBulkOperations(): BulkOperation[] {
  return [
    {
      id: "resend",
      label: "Resend",
      run: (ids) => adminBulkInvitationsResultAction({ ids, op: "resend" }),
    },
    {
      id: "revoke",
      label: "Revoke",
      destructive: true,
      confirm: "Revoke selected invitations?",
      run: (ids) => adminBulkInvitationsResultAction({ ids, op: "revoke" }),
    },
  ];
}
