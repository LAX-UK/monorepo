import "server-only";

import type { TeamTab } from "@/lib/navigation/client-routes";
import { liveAuthorisationsFor } from "@/lib/buyer-agents/authorisation-presenter";
import {
  type TeamScope,
  loadBuyerAgentOverview,
  loadTeamInvitations,
  loadTeamMembers,
} from "./team-data.server";
import { teamTabCounts } from "./team-counts";

/**
 * The count beside each Team tab the person can open: the people, the invitations waiting for an
 * answer and the authorisations in force. A count that could not be read is left off, never shown
 * as 0. Reads are shared with the tab pages (cached for the request).
 */
export async function loadTeamTabCounts(
  scope: TeamScope,
  tabs: readonly { id: TeamTab }[],
): Promise<Partial<Record<TeamTab, number>>> {
  const opens = (id: TeamTab) => tabs.some((tab) => tab.id === id);
  const [members, invitations, overview] = await Promise.all([
    opens("members") ? loadTeamMembers(scope) : null,
    opens("invitations") ? loadTeamInvitations(scope.acting.id) : null,
    opens("bidding") ? loadBuyerAgentOverview(scope) : null,
  ]);
  return teamTabCounts({
    members: members?.ok ? members.data.length : null,
    invitations: invitations?.ok ? invitations.data : null,
    authorisations: overview
      ? overview.buyerAgents.flatMap((agent) =>
          liveAuthorisationsFor(overview.authorisations, agent.userId),
        ).length
      : null,
    now: new Date(),
  });
}
