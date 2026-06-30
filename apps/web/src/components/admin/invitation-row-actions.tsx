"use client";

import { InvitationRevokeButton } from "@/components/admin/invitation-revoke-button";
import { adminResendInvitationResultAction } from "@/lib/actions/admin/admin-invitations";
import {
  type InvitationLifecycleInput,
  invitationCanResend,
  invitationCanRevoke,
  invitationResendDisabledReason,
  invitationRevokeDisabledReason,
} from "@/lib/admin/invite-lifecycle";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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

type Props = {
  invitationId: string;
  lifecycle: InvitationLifecycleInput;
};

export function InvitationRowActions({ invitationId, lifecycle }: Props) {
  const router = useRouter();
  const [resendPending, startResendTransition] = useTransition();

  const canResend = invitationCanResend(lifecycle);
  const canRevoke = invitationCanRevoke(lifecycle);
  const resendReason = invitationResendDisabledReason(lifecycle);
  const revokeReason = invitationRevokeDisabledReason(lifecycle);

  const handleResend = () => {
    startResendTransition(async () => {
      const result = await adminResendInvitationResultAction(invitationId);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex justify-end gap-2">
      <DisabledActionTooltip reason={resendReason}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canResend || resendPending}
          className="font-label text-[10px] uppercase"
          onClick={handleResend}
        >
          {resendPending ? "Resending…" : "Resend"}
        </Button>
      </DisabledActionTooltip>
      <DisabledActionTooltip reason={revokeReason}>
        <InvitationRevokeButton invitationId={invitationId} disabled={!canRevoke} />
      </DisabledActionTooltip>
    </div>
  );
}
