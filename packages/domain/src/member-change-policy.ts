import type { LegalEntityMemberRole } from "@auction/types";
import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import { type EntityActor, entityActorCan, entityRoleCan } from "./entity-capabilities.js";

/** The role a transfer hands over, and the one the previous owner keeps. */
export const OWNER_ROLE: LegalEntityMemberRole = "owner";
export const STEPPED_DOWN_OWNER_ROLE: LegalEntityMemberRole = "admin";

/** Whether a role makes its holder one of the organisation's owners. */
export function holdsOwnership(role: LegalEntityMemberRole): boolean {
  return entityRoleCan(role, "entity.ownership.manage");
}

type TeamMember = { id: string; role: LegalEntityMemberRole; acceptedAt: Date | string | null };

/** How many of these members are owners; pending invitations do not count. */
export function countOwners(members: readonly Omit<TeamMember, "id">[]): number {
  return members.filter((m) => m.acceptedAt != null && holdsOwnership(m.role)).length;
}

/** The person making the change; `memberId` is `null` for support staff viewing as the client. */
export type MemberChangeActor = EntityActor & { memberId: string | null };

/** The member a change is about. */
export type MemberChangeTarget = {
  memberId: string;
  role: LegalEntityMemberRole;
  /** The organisation's only owner: taking the role away would leave it with none. */
  isLastOwner: boolean;
};

/** The target for a change to `member`, judged against the organisation's active `team`. */
export function memberChangeTarget(
  member: TeamMember,
  team: readonly TeamMember[],
): MemberChangeTarget {
  const isOwner = member.acceptedAt != null && holdsOwnership(member.role);
  return { memberId: member.id, role: member.role, isLastOwner: isOwner && countOwners(team) <= 1 };
}

export type MemberChange =
  | { action: "invite"; newRole: LegalEntityMemberRole }
  | { action: "change_role"; target: MemberChangeTarget; newRole: LegalEntityMemberRole }
  | { action: "remove"; target: MemberChangeTarget }
  | { action: "transfer_ownership"; target: MemberChangeTarget };

export type MemberChangeAction = MemberChange["action"];

export type MemberChangeDenial =
  | "read_only"
  | "cannot_manage_members"
  | "owner_only"
  | "last_owner"
  | "self";

/** A change that must be confirmed by typing a phrase that names the member. */
export type MemberChangeConfirmation = "remove" | "transfer_ownership";

export type MemberChangeDecision =
  | { allowed: true; confirmation: MemberChangeConfirmation | null }
  | { allowed: false; reason: MemberChangeDenial; message: string };

export const MEMBER_CHANGE_DENIAL_MESSAGE: Record<MemberChangeDenial, string> = {
  read_only: "You're viewing this organisation as LAX support, so changes are turned off.",
  cannot_manage_members: "Only owners and admins can manage members.",
  owner_only: "Only an owner can grant, change or remove the owner role.",
  last_owner: "An organisation always needs an owner. Make someone else an owner first.",
  self: "You can't change your own role or remove yourself. Ask another owner or admin.",
};

function deny(reason: MemberChangeDenial): MemberChangeDecision {
  return { allowed: false, reason, message: MEMBER_CHANGE_DENIAL_MESSAGE[reason] };
}

function targetOf(change: MemberChange): MemberChangeTarget | null {
  return change.action === "invite" ? null : change.target;
}

/** Whether the change gives or takes away the owner role. */
function touchesOwnership(change: MemberChange): boolean {
  switch (change.action) {
    case "invite":
      return holdsOwnership(change.newRole);
    case "change_role":
      return holdsOwnership(change.target.role) || holdsOwnership(change.newRole);
    case "remove":
      return holdsOwnership(change.target.role);
    case "transfer_ownership":
      return true;
  }
}

/** Whether the change leaves the organisation without an owner. */
function removesLastOwner(change: MemberChange): boolean {
  if (change.action !== "change_role" && change.action !== "remove") return false;
  if (!change.target.isLastOwner) return false;
  return !(change.action === "change_role" && holdsOwnership(change.newRole));
}

/**
 * Typed confirmation for the changes that are hard to undo: removing someone who runs the
 * organisation (they would have to be invited again), and handing over ownership.
 */
function confirmationFor(change: MemberChange): MemberChangeConfirmation | null {
  if (change.action === "transfer_ownership") return "transfer_ownership";
  if (change.action === "remove" && entityRoleCan(change.target.role, "entity.members.manage")) {
    return "remove";
  }
  return null;
}

/**
 * Who may invite, change the role of, remove or hand ownership to a member. First refusal wins:
 * - support staff viewing as the client change nothing;
 * - only members who manage members act at all;
 * - nobody changes their own role or removes themselves here;
 * - only an owner grants, changes or removes the owner role, or transfers ownership;
 * - the organisation always keeps at least one owner.
 */
export function memberChangePolicy(
  actor: MemberChangeActor,
  change: MemberChange,
): MemberChangeDecision {
  if (actor.isImpersonation) return deny("read_only");
  if (!entityActorCan(actor, "entity.members.manage")) return deny("cannot_manage_members");
  const target = targetOf(change);
  if (target && actor.memberId !== null && target.memberId === actor.memberId) {
    return deny("self");
  }
  if (touchesOwnership(change) && !entityActorCan(actor, "entity.ownership.manage")) {
    return deny("owner_only");
  }
  if (removesLastOwner(change)) return deny("last_owner");
  return { allowed: true, confirmation: confirmationFor(change) };
}

/** The phrase a person types to confirm a change, naming the member. */
export function memberChangeConfirmationPhrase(
  confirmation: MemberChangeConfirmation,
  memberName: string,
): string {
  return confirmation === "remove" ? `REMOVE ${memberName}` : `TRANSFER PRIMARY TO ${memberName}`;
}

/** Why a member's buyer-agent authorisations end, recorded on each one. */
export type AuthorisationRevocationCause = "member_removed" | "role_changed";

export const AUTHORISATION_REVOCATION_REASON: Record<AuthorisationRevocationCause, string> = {
  member_removed: "The member left the organisation",
  role_changed: "The member's role changed",
};

/**
 * Whether a change ends the target's buyer-agent authorisations, and why. They only mean
 * something to a role that bids through one; leaving them on a removed or re-roled member
 * would silently bring the old limits back if the person became a buyer agent again.
 */
export function authorisationRevocationFor(
  change: MemberChange,
): AuthorisationRevocationCause | null {
  switch (change.action) {
    case "invite":
      return null;
    case "remove":
      return "member_removed";
    case "change_role":
      return change.newRole !== change.target.role && !roleBidsThroughAuthorisation(change.newRole)
        ? "role_changed"
        : null;
    case "transfer_ownership":
      return roleBidsThroughAuthorisation(OWNER_ROLE) ? null : "role_changed";
  }
}
