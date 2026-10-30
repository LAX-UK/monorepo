import "server-only";

import type { TeamTab } from "@/lib/navigation/client-routes";
import { teamTabCounts } from "./team-counts";
import { type TeamScope, loadTeamInvitations, loadTeamMembers } from "./team-data.server";

/**
 * The count beside each Team tab the person can open: the people and the invitations waiting
 * for an answer. A count that could not be read is left off, never shown as 0. Reads are shared
 * with the tab pages (cached for the request).
 */
export async function loadTeamTabCounts(
  scope: TeamScope,
  tabs: readonly { id: TeamTab }[],
): Promise<Partial<Record<TeamTab, number>>> {
  const opens = (id: TeamTab) => tabs.some((tab) => tab.id === id);
  const [members, invitations] = await Promise.all([
    opens("members") ? loadTeamMembers(scope) : null,
    opens("invitations") ? loadTeamInvitations(scope.acting.id) : null,
  ]);
  return teamTabCounts({
    members: members?.ok ? members.data.length : null,
    invitations: invitations?.ok ? invitations.data : null,
    now: new Date(),
  });
}
