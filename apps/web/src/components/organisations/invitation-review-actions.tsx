"use client";

import {
  acceptInvitationByIdAction,
  declineInvitationByIdAction,
} from "@/lib/legal-entity/invitation.actions";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = { invitation: PendingInvitationRow };

export function InvitationReviewActions({ invitation }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="cta"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await acceptInvitationByIdAction(invitation.id);
            if (r.ok) {
              notify.success("Invitation accepted", {
                description: `You've joined ${invitation.orgDisplayName}.`,
              });
              router.push(`/dashboard/organisations/${r.data.legalEntityId}?welcome=1`);
              router.refresh();
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
        variant="outline"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await declineInvitationByIdAction(invitation.id);
            if (r.ok) {
              notify.success("Invitation declined");
              router.push("/dashboard/invitations");
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
