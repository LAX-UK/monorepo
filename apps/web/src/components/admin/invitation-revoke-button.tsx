"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { adminRevokeInvitationResultAction } from "@/lib/actions/admin/admin-invitations";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function InvitationRevokeButton({
  invitationId,
  disabled,
}: {
  invitationId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await adminRevokeInvitationResultAction(invitationId);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <ConfirmActionButton
      variant="ghost"
      size="sm"
      disabled={disabled || pending}
      className="font-label text-[10px] uppercase"
      confirmTitle="Revoke invitation?"
      confirmBody="The invite link will stop working immediately."
      confirmLabel="Revoke"
      tone="danger"
      onConfirmed={handleRevoke}
    >
      {pending ? "Revoking…" : "Revoke"}
    </ConfirmActionButton>
  );
}
