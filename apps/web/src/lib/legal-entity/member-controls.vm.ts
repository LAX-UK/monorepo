import {
  type MemberChangeActor,
  memberChangeConfirmationPhrase,
  memberChangePolicy,
  memberChangeTarget,
  memberLeavePolicy,
} from "@auction/domain";
import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";

/** Whether the person may leave, or why not, in words. */
export type LeaveControl = { allowed: true } | { allowed: false; reason: string };

/**
 * Whether `actor` may leave the organisation, judged against the whole team so the last owner is
 * told to hand ownership on first. `null` when the person is not in the list (support staff).
 */
export function leaveControl(
  actor: MemberChangeActor,
  team: readonly (MemberForControls & { id: string })[],
): LeaveControl | null {
  const me = team.find((member) => member.id === actor.memberId);
  if (!me) return null;
  const decision = memberLeavePolicy({
    actor,
    accountKind: "organisation",
    self: memberChangeTarget(me, team),
  });
  return decision.allowed ? { allowed: true } : { allowed: false, reason: decision.message };
}

/** The member fields the controls need. */
export type MemberForControls = {
  id: string;
  role: LegalEntityMemberRole;
  acceptedAt: string | null;
  user: { name: string };
};

/** What the person may do to one member, straight from the member change policy. */
export type MemberRowControls = {
  /** The roles offered in the role picker, the current one first; empty means read-only. */
  roleOptions: LegalEntityMemberRole[];
  /** Whether the person may remove this member (confirmed in a dialog). */
  remove: boolean;
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
  const transfer = memberChangePolicy(actor, { action: "transfer_ownership", target });
  return {
    roleOptions: otherRoles.length > 0 ? [member.role, ...otherRoles] : [],
    remove: memberChangePolicy(actor, { action: "remove", target }).allowed,
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

/** Whether the person may resend or withdraw an invitation for `role` (as if sending it). */
export function canManageInvitation(
  actor: MemberChangeActor,
  role: LegalEntityMemberRole,
): boolean {
  return memberChangePolicy(actor, { action: "invite", newRole: role }).allowed;
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
