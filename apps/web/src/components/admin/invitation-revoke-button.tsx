"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { adminRevokeInvitationAction } from "@/lib/actions/admin";

export function InvitationRevokeButton({
  invitationId,
  disabled,
}: {
  invitationId: string;
  disabled?: boolean;
}) {
  const formId = `revoke-invitation-${invitationId}`;

  return (
    <form id={formId} action={adminRevokeInvitationAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <ConfirmFormSubmit
        formId={formId}
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="font-label text-[10px] uppercase"
        confirmTitle="Revoke invitation?"
        confirmBody="The invite link will stop working immediately."
        confirmLabel="Revoke"
        tone="danger"
      >
        Revoke
      </ConfirmFormSubmit>
    </form>
  );
}
