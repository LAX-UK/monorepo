import type { LegalEntityMemberRole } from "@auction/types";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityRoleCan,
  isEntityCapability,
} from "./entity-capabilities.js";

/**
 * "Ask for access": a member asks the people who run the organisation for a role, or for one
 * thing they can't do yet (a capability). An owner or admin approves it by giving a role, or
 * declines it; either way the member is told and the decision is kept in Activity.
 */
export const ACCESS_REQUEST_STATUSES = ["pending", "approved", "declined", "withdrawn"] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

/** What is asked for: a role, or a capability the member's role lacks. */
export type AccessAsk =
  | { kind: "role"; role: LegalEntityMemberRole }
  | { kind: "capability"; capability: EntityCapability };

export type AccessAskRefusal =
  /** A platform admin viewing as the organisation cannot ask for anything. */
  | "access_read_only"
  /** The member already has the role or can already do it. */
  | "access_already_held"
  /** Not a capability the organisation knows. */
  | "access_unknown_capability";

/** Whether `actor` may ask for `ask`; `null` when they may. */
export function accessAskRefusal(actor: EntityActor, ask: AccessAsk): AccessAskRefusal | null {
  if (actor.isImpersonation) return "access_read_only";
  if (ask.kind === "role") return ask.role === actor.role ? "access_already_held" : null;
  if (!isEntityCapability(ask.capability)) return "access_unknown_capability";
  return entityActorCan(actor, ask.capability) ? "access_already_held" : null;
}

/** Who sees and decides the organisation's access requests (owners and admins). */
export function canDecideAccessRequests(actor: EntityActor): boolean {
  return entityActorCan(actor, "entity.members.manage");
}

export type AccessApprovalRefusal =
  /** A capability request needs the role to give. */
  | "access_role_required"
  /** The chosen role does not hold what was asked for. */
  | "access_role_lacks_capability"
  /** A role request is approved with the role asked for, or declined. */
  | "access_role_mismatch";

/**
 * The role an approval gives. A role request gives the role asked for; a capability request
 * gives a role the approver chooses, which must hold the capability. Who may give which role
 * (only owners make owners) stays with the member-change rules the role change goes through.
 */
export function approvalRole(
  ask: AccessAsk,
  chosen: LegalEntityMemberRole | null,
): { role: LegalEntityMemberRole } | { refused: AccessApprovalRefusal } {
  if (ask.kind === "role") {
    if (chosen && chosen !== ask.role) return { refused: "access_role_mismatch" };
    return { role: ask.role };
  }
  if (!chosen) return { refused: "access_role_required" };
  if (!entityRoleCan(chosen, ask.capability)) return { refused: "access_role_lacks_capability" };
  return { role: chosen };
}

/** A decision is taken once, from pending; a member may withdraw only their own pending ask. */
export function accessRequestOpen(status: AccessRequestStatus): boolean {
  return status === "pending";
}

export type AccessDecisionRefusal =
  /** Only owners and admins decide. */
  | "access_not_decider"
  /** Nobody decides their own request, so no one gives themselves a role. */
  | "access_own_request";

/** Whether `actor` may approve or decline a request from `requesterUserId`. */
export function accessDecisionRefusal(
  actor: EntityActor & { userId: string },
  requesterUserId: string,
): AccessDecisionRefusal | null {
  if (!canDecideAccessRequests(actor)) return "access_not_decider";
  if (actor.userId === requesterUserId) return "access_own_request";
  return null;
}
