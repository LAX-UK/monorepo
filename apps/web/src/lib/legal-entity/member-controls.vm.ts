import {
  type MemberChangeActor,
  memberChangeConfirmationPhrase,
  memberChangePolicy,
  memberChangeTarget,
} from "@auction/domain";
import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";

/** The member fields the controls need. */
export type MemberForControls = {
  id: string;
  role: LegalEntityMemberRole;
  acceptedAt: string | null;
  user: { name: string };
};

/** What the person may do to one member, straight from the member change policy. */
export type MemberRowControls = {
  /** The roles offered in the role picker, the current one first; one or none is read-only. */
  roleOptions: LegalEntityMemberRole[];
  /** Removal, with the phrase to type when it must be confirmed; `null` when not offered. */
  remove: { confirmPhrase: string | null } | null;
  /** Handing ownership to this member, with the phrase to type; `null` when not offered. */
  transfer: { confirmPhrase: string } | null;
};

/** The controls for every member, judged against the whole team (for the last-owner rule). */
export function memberRowControls(
  actor: MemberChangeActor,
  member: MemberForControls,
  team: readonly MemberForControls[],
): MemberRowControls {
  const target = memberChangeTarget(member, team);
  const otherRoles = legalEntityMemberRoles.filter(
    (role) =>
      role !== member.role &&
      memberChangePolicy(actor, { action: "change_role", target, newRole: role }).allowed,
  );
  const removal = memberChangePolicy(actor, { action: "remove", target });
  const transfer = memberChangePolicy(actor, { action: "transfer_ownership", target });
  return {
    roleOptions: otherRoles.length > 0 ? [member.role, ...otherRoles] : [],
    remove: removal.allowed
      ? {
          confirmPhrase: removal.confirmation
            ? memberChangeConfirmationPhrase(removal.confirmation, member.user.name)
            : null,
        }
      : null,
    // Ownership goes only to someone who has joined.
    transfer:
      transfer.allowed && member.acceptedAt
        ? { confirmPhrase: memberChangeConfirmationPhrase("transfer_ownership", member.user.name) }
        : null,
  };
}

/** The roles the person may invite someone as; empty when they may not invite. */
export function inviteRoleOptions(actor: MemberChangeActor): LegalEntityMemberRole[] {
  return legalEntityMemberRoles.filter(
    (role) => memberChangePolicy(actor, { action: "invite", newRole: role }).allowed,
  );
}

/** Why the person can see the team but change nothing, or `null` when they can make changes. */
export function memberViewOnlyReason(actor: MemberChangeActor): string | null {
  if (inviteRoleOptions(actor).length > 0) return null;
  const decision = memberChangePolicy(actor, {
    action: "invite",
    newRole: legalEntityMemberRoles[legalEntityMemberRoles.length - 1] as LegalEntityMemberRole,
  });
  return decision.allowed ? null : decision.message;
}
