import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { getServerBuyerAgentOverview } from "@/lib/data/http/buyer-agent-authorisations.server";
import { getServerStoppedMemberBids } from "@/lib/data/http/organisation-membership.server";
import {
  getServerAccessRequests,
  getServerBiddingLimits,
} from "@/lib/data/http/organisation-team.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import type { ActingLegalEntitySummary } from "@/lib/legal-entity/client-acting-context";
import { type EntityActor, type MemberChangeActor, entityActorCan } from "@auction/domain";
import { createLegalEntityMemberListGateway } from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { cache } from "react";

/**
 * The Team page's reads. The layout (for the tab counts and the invite button) and each tab read
 * the same things, so every read is cached for the request: one network call each, however many
 * parts of the page ask.
 */

/** The acting organisation as the Team page sees it, or `null` for a personal account. */
export type TeamScope = {
  acting: ActingLegalEntitySummary & { id: string; displayName: string };
  actor: EntityActor;
};

type Viewer = Pick<SessionUser, "id" | "role" | "staffRoles">;

/** The acting organisation for `user`, read once per request (keyed by who is asking). */
export function loadTeamScope(user: Viewer): Promise<TeamScope | null> {
  return scopeFor(user.id, user.role, JSON.stringify(user.staffRoles ?? null));
}

const scopeFor = cache(
  async (_userId: string, role: Viewer["role"], staffRolesJson: string) => {
    const staffRoles = JSON.parse(staffRolesJson) as Viewer["staffRoles"] | null;
    const active = await resolveActiveOrganisationActor({
      role,
      ...(staffRoles ? { staffRoles } : {}),
    });
    if (!active) return null;
    const ctx = await createPerOrgGateway().getContext(active.organisation.id);
    if (!ctx) return null;
    const { member } = ctx;
    return {
      acting: {
        id: active.organisation.id,
        displayName: member.displayName,
        kind: member.kind,
        subkind: member.subkind,
        status: member.status,
        role: member.role,
        isPrimaryAdmin: member.isPrimaryAdmin,
      },
      actor: active.actor,
    } satisfies TeamScope;
  },
);

export const loadTeamMembers = cache((scope: TeamScope) =>
  createLegalEntityMemberListGateway().fetchMemberListForActing(scope.acting),
);

export const loadTeamInvitations = cache((legalEntityId: string) =>
  createLegalEntityMemberListGateway().fetchPendingInvitations(legalEntityId),
);

/** Buyer agents and their authorisations; `null` for members who may not see them. */
export const loadBuyerAgentOverview = cache((scope: TeamScope) =>
  entityActorCan(scope.actor, "entity.buyer_agents.read")
    ? getServerBuyerAgentOverview(scope.acting.id).catch(() => null)
    : Promise.resolve(null),
);

/** The organisation limit and each authorisation's total, with what is in use. */
export const loadBiddingLimits = cache((legalEntityId: string) =>
  getServerBiddingLimits(legalEntityId).catch(() => null),
);

/** Who has two-step on, for owners and admins. */
export const loadTwoStepPolicy = cache((scope: TeamScope) =>
  entityActorCan(scope.actor, "entity.security.read")
    ? getServerOrgTwoFactorPolicy(scope.acting.id).catch(() => null)
    : Promise.resolve(null),
);

/** Requests waiting for an owner or admin. */
export const loadPendingAccessRequests = cache((legalEntityId: string) =>
  getServerAccessRequests(legalEntityId, "pending").catch(() => null),
);

/** Automatic bids that stopped when their member left. */
export const loadStoppedMemberBids = cache((legalEntityId: string) =>
  getServerStoppedMemberBids(legalEntityId).catch(() => null),
);

/** The viewer as the member change rules see them (support staff are not in the list). */
export function memberChangeActorFor(
  scope: TeamScope,
  userId: string,
  members: readonly { id: string; userId: string }[],
): MemberChangeActor {
  return { ...scope.actor, memberId: members.find((m) => m.userId === userId)?.id ?? null };
}
