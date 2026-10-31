import { StoppedMemberBidsSection } from "@/components/legal-entity/stopped-member-bids-section";
import { WhoCanBid } from "@/components/organisation-team/who-can-bid-view";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { ListLoadError } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { teamHref } from "@/lib/navigation/client-routes";
import { requireTeamTab } from "@/lib/navigation/team-tabs";
import {
  loadBiddingLimits,
  loadBuyerAgentOverview,
  loadStoppedMemberBids,
  loadTeamScope,
} from "@/lib/organisation-team/team-data.server";
import { whoCanBidView } from "@/lib/organisation-team/who-can-bid.vm";
import { notFound } from "next/navigation";

/**
 * Team's "Who can bid" tab: the organisation's bidding limit, each buyer agent's authorisations
 * with their limits and what is in use, and the automatic bids that stopped when someone left.
 */
export default async function TeamBiddingPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: teamHref("bidding") });
  const scope = await loadTeamScope(user);
  if (!scope) notFound();
  const { acting, actor } = scope;
  const access = requireTeamTab(actor, "bidding");
  if (access.kind === "forbidden") {
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        organisationName={acting.displayName}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const [overview, limits, stopped] = await Promise.all([
    loadBuyerAgentOverview(scope),
    loadBiddingLimits(acting.id),
    loadStoppedMemberBids(acting.id),
  ]);
  if (!overview) {
    return <ListLoadError />;
  }

  return (
    <div className="flex flex-col gap-8">
      <WhoCanBid
        legalEntityId={acting.id}
        organisationName={acting.displayName}
        view={whoCanBidView({ overview, limits, now: new Date() })}
        sales={overview.sales}
      />
      <StoppedMemberBidsSection entityName={acting.displayName} stopped={stopped ?? []} />
    </div>
  );
}
