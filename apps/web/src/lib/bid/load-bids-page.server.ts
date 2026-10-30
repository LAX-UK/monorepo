import "server-only";

import type { BuyerAgentBannerVm } from "@/lib/bid/buyer-agent-banner";
import { buildBuyerAgentBanner } from "@/lib/bid/buyer-agent-banner";
import { type MyBidsVm, buildMyBidsVm } from "@/lib/bid/my-bids.vm";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import {
  getServerAccountRegistrations,
  getServerBiddingLimits,
} from "@/lib/data/http/account-buying.server";
import type { AccountRegistrationView } from "@/lib/data/http/account-buying.types";
import { getServerMyBuyerAgentAuthorisations } from "@/lib/data/http/organisation-membership.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { resolveActiveOrganisation } from "@/lib/legal-entity/active-organisation.server";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import {
  accountBidScope,
  entityCapabilitiesOf,
  organisationStatePolicy,
  roleBidsThroughAuthorisation,
} from "@auction/domain";

export type LoadedBidsPage = {
  vm: MyBidsVm | null;
  /** `undefined` for a person's own account, which registers sale by sale on each sale page. */
  registrations: AccountRegistrationView[] | null | undefined;
  organisation: string | null;
  shared: boolean;
  /** Why bidding is off for the account, or `null` while it is open. */
  bidBlockedReason: string | null;
  /** A buyer agent's authority, above their bids; `null` for every other role. */
  agentBanner: BuyerAgentBannerVm | null;
  userId: string | null;
};

/**
 * Everything Bids shows for the account in use, each read on its own so one failure leaves the
 * rest of the page working: the bids (with who placed them on a shared list), the sales the
 * account is registered for, whether bidding is open, and a buyer agent's authority.
 */
export async function loadBidsPage(user: SessionUser | null): Promise<LoadedBidsPage> {
  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  const organisation = scope.account.kind === "organisation" ? scope.account : null;
  const shared = organisation ? accountBidScope(organisation.actor) === "all" : false;
  const agent = organisation ? roleBidsThroughAuthorisation(organisation.actor.role) : false;

  const [bidsResult, registrationsResult, summaryResult, mineResult, limitsResult] =
    await Promise.allSettled([
      container.buying.bids(),
      organisation ? getServerAccountRegistrations(organisation.id) : Promise.resolve(undefined),
      organisation && user ? resolveActiveOrganisation(user) : Promise.resolve(null),
      organisation && agent
        ? getServerMyBuyerAgentAuthorisations(organisation.id)
        : Promise.resolve(null),
      organisation && agent ? getServerBiddingLimits(organisation.id) : Promise.resolve(null),
    ]);

  let vm: MyBidsVm | null = null;
  if (bidsResult.status === "fulfilled") {
    const rows = bidsResult.value;
    vm = buildMyBidsVm({
      rows,
      userId: user?.id,
      showPlacedBy: shared,
      saleTitleById: await resolveSaleTitles(rows.map((row) => row.lot?.saleId)),
    });
  }

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  let bidBlockedReason: string | null = null;
  if (organisation && summary) {
    const policy = organisationStatePolicy(
      summary.status,
      entityCapabilitiesOf(organisation.actor),
    );
    if (policy.bidPanelReasonKey) {
      bidBlockedReason = organisationBidReasonCopy(policy.bidPanelReasonKey, {
        organisationName: organisation.name,
      }).title;
    }
  }

  const authorisations = mineResult.status === "fulfilled" ? mineResult.value : null;
  return {
    vm,
    registrations:
      registrationsResult.status === "fulfilled"
        ? registrationsResult.value
        : organisation
          ? null
          : undefined,
    organisation: organisation?.name ?? null,
    shared,
    bidBlockedReason,
    agentBanner:
      organisation && agent && authorisations
        ? buildBuyerAgentBanner({
            organisation: organisation.name,
            authorisations,
            limits: limitsResult.status === "fulfilled" ? limitsResult.value : null,
          })
        : null,
    userId: user?.id ?? null,
  };
}
