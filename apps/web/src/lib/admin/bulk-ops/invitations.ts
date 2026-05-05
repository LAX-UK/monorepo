import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { adminBulkInvitationsResultAction } from "@/lib/actions/admin";

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
