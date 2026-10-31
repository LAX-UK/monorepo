"use client";

import { MemberChangeDialog } from "@/components/legal-entity/members/member-change-dialog";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { leaveOrganisationCopy } from "@/lib/legal-entity/member-change-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { leaveOrganisationAction } from "@/lib/organisation-team/organisation-team.actions";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  legalEntityId: string;
  organisationName: string;
  onClose: () => void;
};

/**
 * Leaving the organisation: what the person loses and what stops, then a plain confirm. Once
 * the server agrees, Bid moves to the person's own account and opens its Home, since nothing in
 * the organisation is theirs to see any more.
 */
export function LeaveOrganisationDialog({ legalEntityId, organisationName, onClose }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = leaveOrganisationCopy(organisationName);

  async function leave() {
    setPending(true);
    setError(null);
    const result = await leaveOrganisationAction(legalEntityId);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    await switchActingLegalEntity(null);
    notify.success(copy.done().title);
    router.push(CLIENT_ROUTES.home);
    router.refresh();
  }

  return (
    <MemberChangeDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={copy.title}
      lines={copy.lines}
      confirmLabel={copy.confirmLabel}
      tone="danger"
      pending={pending}
      error={error}
      onConfirm={() => void leave()}
    />
  );
}
