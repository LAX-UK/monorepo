"use client";

import { useAccountSwitch } from "@/components/layout/account-switcher/use-account-switch";
import {
  acceptInvitationByIdAction,
  declineInvitationByIdAction,
} from "@/lib/legal-entity/invitation.actions";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = { invitation: PendingInvitationRow };

export function InvitationReviewActions({ invitation }: Props) {
  const router = useRouter();
  const { choose } = useAccountSwitch();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await acceptInvitationByIdAction(invitation.id);
            if (r.ok) {
              notify.success("Invitation accepted", {
                description: `You've joined ${invitation.orgDisplayName}.`,
              });
              // Joining changes the account in use: switch, then load the organisation's Home afresh.
              await choose({ id: r.data.legalEntityId, current: false });
              return;
            }
            notify.error("Could not accept invitation", { description: r.error });
          });
        }}
      >
        Accept
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await declineInvitationByIdAction(invitation.id);
            if (r.ok) {
              notify.success("Invitation declined");
              router.push("/organisations/invitations");
              router.refresh();
              return;
            }
            notify.error("Could not decline invitation", { description: r.error });
          });
        }}
      >
        Decline
      </Button>
    </div>
  );
}
