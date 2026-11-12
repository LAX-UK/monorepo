"use client";

import { changeRoleCopy } from "@/lib/legal-entity/member-change-copy";
import type { MemberChangeResult } from "@/lib/legal-entity/member-management.actions";
import { roleAbilities } from "@/lib/organisation-team/role-abilities";
import {
  organisationRoleDescription,
  organisationRoleLabel,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { LegalEntityMemberRole } from "@auction/types";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Notice } from "@auction/ui/lax/notice";
import { PresetCards } from "@auction/ui/lax/preset-cards";
import { useEffect, useRef, useState } from "react";
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
      className="grid grid-cols-3 gap-x-4 rounded-lax-md border border-lax-line bg-lax-surface-2 px-4 py-3"
    >
      {roleAbilities(role).map((ability) => (
        <div key={ability.id} className="flex flex-col gap-0.5">
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
  const summaryRef = useRef<HTMLDivElement>(null);

  // On a phone the summary sits below the fold; bring it into view when the choice changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the chosen role changes.
  useEffect(() => {
    if (!unchanged) summaryRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [role]);

  async function submit() {
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
      wide
      pending={pending}
      error={error}
      confirmBlockedReason={unchanged ? copy.sameRoleReason : null}
      onConfirm={() => void submit()}
    >
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="sr-only">Role</legend>
        <PresetCards
          label="Role"
          columns={2}
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
            ...(value === currentRole
              ? { tag: <StatusBadge tone="neutral">Current</StatusBadge> }
              : {}),
          }))}
        />
        <div ref={summaryRef} className="flex flex-col gap-3">
          <RoleAbilities role={role} />
          {consequence ? <Notice tone="warning" title={consequence} /> : null}
        </div>
      </fieldset>
    </MemberChangeDialog>
  );
}
