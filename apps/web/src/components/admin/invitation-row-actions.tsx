"use client";

import { InvitationRevokeButton } from "@/components/admin/invitation-revoke-button";
import { adminResendInvitationAction } from "@/lib/actions/admin";
import {
  type InvitationLifecycleInput,
  invitationCanResend,
  invitationCanRevoke,
  invitationResendDisabledReason,
  invitationRevokeDisabledReason,
} from "@/lib/admin/invite-lifecycle";
import { Button } from "@auction/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { useFormStatus } from "react-dom";

function DisabledActionTooltip({
  reason,
  children,
}: {
  reason: string | null;
  children: React.ReactNode;
}) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function ResendSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      className="font-label text-[10px] uppercase"
    >
      {pending ? "Resending…" : "Resend"}
    </Button>
  );
}

type Props = {
  invitationId: string;
  lifecycle: InvitationLifecycleInput;
};

export function InvitationRowActions({ invitationId, lifecycle }: Props) {
  const canResend = invitationCanResend(lifecycle);
  const canRevoke = invitationCanRevoke(lifecycle);
  const resendReason = invitationResendDisabledReason(lifecycle);
  const revokeReason = invitationRevokeDisabledReason(lifecycle);

  return (
    <div className="flex justify-end gap-2">
      <DisabledActionTooltip reason={resendReason}>
        <form action={adminResendInvitationAction}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <ResendSubmitButton disabled={!canResend} />
        </form>
      </DisabledActionTooltip>
      <DisabledActionTooltip reason={revokeReason}>
        <InvitationRevokeButton invitationId={invitationId} disabled={!canRevoke} />
      </DisabledActionTooltip>
    </div>
  );
}
