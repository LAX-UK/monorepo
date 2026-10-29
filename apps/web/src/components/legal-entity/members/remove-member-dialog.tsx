"use client";

import { removeMemberCopy } from "@/lib/legal-entity/member-change-copy";
import { removeMemberAction } from "@/lib/legal-entity/member-management.actions";
import { notify } from "@/lib/ui/notify";
import { useState } from "react";
import { MemberChangeDialog } from "./member-change-dialog";

type Props = {
  legalEntityId: string;
  organisationName: string;
  member: { id: string; name: string };
  /** Called once the server has removed the member, before the dialog closes. */
  onRemoved?: () => void;
  onClose: () => void;
};

/** Removing a member: says who, from which organisation and what stops, then a plain confirm. */
export function RemoveMemberDialog({
  legalEntityId,
  organisationName,
  member,
  onRemoved,
  onClose,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = removeMemberCopy(member.name, organisationName);

  async function confirmRemoval() {
    setPending(true);
    setError(null);
    const result = await removeMemberAction(legalEntityId, member.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    notify.success(copy.done().title);
    onRemoved?.();
    onClose();
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
      onConfirm={() => void confirmRemoval()}
    />
  );
}
