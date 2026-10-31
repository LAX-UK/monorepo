import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import {
  loadBiddingLimits,
  loadBuyerAgentOverview,
  loadTeamMembers,
  loadTeamScope,
} from "@/lib/organisation-team/team-data.server";
import { whoCanBidView } from "@/lib/organisation-team/who-can-bid.vm";
import { entityActorCan } from "@auction/domain";
import type { BiddingOrganisation } from "./bidding-standing";

/** When LAX last changed the organisation's state; `null` when it can't be read. */
async function checkedAt(legalEntityId: string): Promise<Date | null> {
  try {
    const res = await authedServerFetch(`/legal-entities/${encodeURIComponent(legalEntityId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      data?: { statusChangedAt?: string | null };
    } | null;
    const raw = body?.data?.statusChangedAt;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

/**
 * What Bid settings' Bidding card reads for the organisation in use: its state and check date,
 * the limits (for roles that bid), and how many can bid (for owners and admins). `null` for a
 * personal account. Each read fails on its own: the card says what it couldn't read.
 */
export async function loadBiddingOrganisation(
  user: Pick<SessionUser, "id" | "role" | "staffRoles">,
): Promise<BiddingOrganisation | null> {
  const scope = await loadTeamScope(user);
  if (!scope) return null;
  const { acting, actor } = scope;
  const bids = entityActorCan(actor, "entity.bid.place");
  const countsBidders = entityActorCan(actor, "entity.members.manage");
  const [date, limits, members, overview] = await Promise.all([
    checkedAt(acting.id),
    bids ? loadBiddingLimits(acting.id) : Promise.resolve(null),
    countsBidders ? loadTeamMembers(scope).catch(() => null) : Promise.resolve(null),
    countsBidders ? loadBuyerAgentOverview(scope) : Promise.resolve(null),
  ]);
  let biddersCount: number | null = null;
  if (members?.ok) {
    const managers = members.data.filter((m) => m.role === "owner" || m.role === "admin").length;
    const agents = overview
      ? new Set(
          whoCanBidView({ overview, limits, now: new Date() }).rows.map((r) => r.agent.userId),
        ).size
      : 0;
    biddersCount = managers + agents;
  }
  return {
    name: acting.displayName,
    status: acting.status,
    checkedAt: date,
    actor,
    limits,
    biddersCount,
    userId: user.id,
  };
}
