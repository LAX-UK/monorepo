import "server-only";

import {
  getServerAccessRequests,
  getServerOwnerNames,
} from "@/lib/data/http/organisation-team.server";
import { askAnOwnerLine } from "@/lib/presenters/workspace-access/access-reason";
import type { EntityActor, EntityCapability } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import { askableRoles } from "./access-requests.vm";

/** What an access page offers a member: the roles to ask for, a request waiting, whom to ask. */
export type AccessAsk = {
  legalEntityId: string;
  roles: readonly LegalEntityMemberRole[];
  waiting: { id: string; role: LegalEntityMemberRole | null } | null;
  /** "Need access? Ask an owner: Maya Okafor", only when the page has no way to ask. */
  footnote: string | null;
};

/**
 * Reads what "Ask for access" needs on a page the member can't open: the roles above theirs that
 * would open it, their own request if one is waiting, and an owner's name. A support session
 * viewing as the client asks for nothing. Each read fails quietly: the page still explains. There
 * is one way to ask: the owner is named only when "Ask for access" is not on offer.
 */
export async function loadAccessAsk(input: {
  legalEntityId: string;
  actor: EntityActor;
  userId: string;
  capabilities: readonly EntityCapability[];
}): Promise<AccessAsk> {
  const roles = input.actor.isImpersonation
    ? []
    : askableRoles(input.actor.role, input.capabilities);
  const [requests, owners] = await Promise.all([
    roles.length > 0
      ? getServerAccessRequests(input.legalEntityId, "pending").catch(() => null)
      : Promise.resolve(null),
    roles.length === 0 && input.actor.role !== "owner"
      ? getServerOwnerNames(input.legalEntityId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const mine = requests?.find((request) => request.requesterUserId === input.userId) ?? null;
  return {
    legalEntityId: input.legalEntityId,
    roles,
    waiting: mine ? { id: mine.id, role: mine.requestedRole } : null,
    footnote: askAnOwnerLine(owners ?? []),
  };
}
