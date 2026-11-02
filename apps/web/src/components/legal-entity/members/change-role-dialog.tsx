"use client";

import { changeRoleCopy } from "@/lib/legal-entity/member-change-copy";
import type { MemberChangeResult } from "@/lib/legal-entity/member-management.actions";
import { roleAbilities } from "@/lib/organisation-team/role-abilities";
import {
  organisationRoleDescription,
  organisationRoleLabel,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { LegalEntityMemberRole } from "@auction/types";
import { Notice, PresetCards } from "@auction/ui/lax";
import { useState } from "react";
import { MemberChangeDialog } from "./member-change-dialog";

type Props = {
  organisationName: string;
  member: { id: string; name: string };
  /** The role they hold now. */
  currentRole: LegalEntityMemberRole;
  /** The roles the viewer may give, the current one included. */
  roleOptions: readonly LegalEntityMemberRole[];
  /** Sends the change; resolves once the server has answered. */
  onConfirm: (role: LegalEntityMemberRole) => Promise<MemberChangeResult>;
  onClose: () => void;
};

/** What the chosen role means for bidding, paying and selling, as text. */
function RoleAbilities({ role }: { role: LegalEntityMemberRole }) {
  return (
    <dl
      aria-label={`What ${organisationRoleLabel(role)} can do`}
      className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lax-md border border-lax-line bg-lax-surface-2 px-4 py-3 @md:grid-cols-3"
    >
      {roleAbilities(role).map((ability) => (
        <div key={ability.id} className="flex items-baseline justify-between gap-3 @md:block">
          <dt className="text-lax-12 text-lax-muted">{ability.label}</dt>
          <dd className="text-lax-ui font-medium text-lax-fg">{ability.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Change role": one dialog per person. The roles the viewer may give are cards with what each
 * is for, the chosen one spells out whether it can bid, pay and sell, and a change that ends
 * someone's authorisations says so before it is confirmed. A refusal stays in the dialog.
 */
export function ChangeRoleDialog({
  organisationName,
  member,
  currentRole,
  roleOptions,
  onConfirm,
  onClose,
}: Props) {
  const [role, setRole] = useState(currentRole);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = changeRoleCopy(member.name, organisationName);
  const unchanged = role === currentRole;
  const consequence = copy.consequence(currentRole, role);

  async function confirm() {
    if (unchanged) return;
    setPending(true);
    setError(null);
    const result = await onConfirm(role);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error);
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
      confirmBlockedReason={unchanged ? copy.sameRoleReason : null}
      onConfirm={() => void confirm()}
    >
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="sr-only">Role</legend>
        <PresetCards
          label="Role"
          columns={1}
          compact
          value={role}
          onValueChange={(next) => {
            setRole(next);
            setError(null);
          }}
          options={roleOptions.map((value) => ({
            value,
            label: organisationRoleLabel(value),
            description: organisationRoleDescription(value),
            ...(value === currentRole ? { tag: "Current" } : {}),
          }))}
        />
        <RoleAbilities role={role} />
        {consequence ? <Notice tone="warning" title={consequence} /> : null}
      </fieldset>
    </MemberChangeDialog>
  );
}
