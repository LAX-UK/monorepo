"use client";

import { transferOwnershipCopy } from "@/lib/legal-entity/member-change-copy";
import { transferOwnershipAction } from "@/lib/legal-entity/member-management.actions";
import { notify } from "@/lib/ui/notify";
import { Field, TextInput } from "@auction/ui/lax";
import { useState } from "react";
import { MemberChangeDialog } from "./member-change-dialog";

type Props = {
  legalEntityId: string;
  organisationName: string;
  member: { id: string; name: string };
  /** The sentence-case phrase to type: "Transfer to Lena Fischer". */
  confirmPhrase: string;
  onClose: () => void;
};

/**
 * Handing ownership over, the one member change typed to confirm: the person gives up running
 * the organisation and cannot take it back alone. Once done, it says what their own role is now.
 */
export function TransferOwnershipDialog({
  legalEntityId,
  organisationName,
  member,
  confirmPhrase,
  onClose,
}: Props) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = transferOwnershipCopy(member.name, organisationName);
  const matches = typed.trim() === confirmPhrase;

  async function confirmTransfer() {
    if (!matches) return;
    setPending(true);
    setError(null);
    const result = await transferOwnershipAction(legalEntityId, member.id, confirmPhrase);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const done = copy.done();
    notify.success(done.title, done.description ? { description: done.description } : undefined);
    onClose();
  }

  return (
    <MemberChangeDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={copy.title}
      lines={copy.lines}
      confirmLabel={copy.confirmLabel}
      tone="default"
      pending={pending}
      error={error}
      confirmBlockedReason={matches ? null : `Type "${confirmPhrase}" to confirm.`}
      onConfirm={() => void confirmTransfer()}
    >
      <Field
        label={
          <span>
            To confirm, type <span className="font-semibold">{confirmPhrase}</span>
          </span>
        }
      >
        <TextInput
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void confirmTransfer();
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
        />
      </Field>
    </MemberChangeDialog>
  );
}
