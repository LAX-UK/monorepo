import "server-only";

import { openBidsFigure, purchasesToPayFigure } from "@/lib/buying/account-buying-figures";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { listServerUnsoldOutcomes } from "@/lib/data/http/consignment-after-sale.server";
import { getServerNeedsYou } from "@/lib/data/http/needs-you.server";
import { getServerOrganisationDashboard } from "@/lib/data/http/organisation-dashboard.server";
import {
  getServerMyBuyerAgentAuthorisations,
  getServerStoppedMemberBids,
} from "@/lib/data/http/organisation-membership.server";
import { type PagedRead, readAllPages } from "@/lib/data/paging/read-all-pages";
import { listMembersAction } from "@/lib/legal-entity/member-management.actions";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import {
  type DashboardFigures,
  type EntityActor,
  type EntityCapability,
  type OrganisationHomeFacts,
  accountBidScope,
  accountPurchaseScope,
  bidAuthorityFigure,
  buildOrganisationHome,
  dashboardFigureGroupsFor,
  entityActorCan,
  roleBidsThroughAuthorisation,
  welcomeCardFor,
} from "@auction/domain";
import type {
  ItemSubmission,
  LegalEntitySummary,
  Lot,
  PortfolioRow,
  SellerUnsoldOutcome,
} from "@auction/types";
import { abilityPhrases, roleExplanation, roleQuestion, welcomeHeadline } from "./member-role-copy";
import { homeActivityEvents } from "./organisation-home-activity";
import {
  type OrganisationHomeView,
  type WelcomeCardView,
  buyerAgentAuthorityLine,
  organisationHomeView,
} from "./organisation-home-view";

/** Lists are read page by page up to this many rows; past it, Home says so. */
const LIST_PAGING = { pageSize: 100, maxRows: 1000 } as const;

const EMPTY_READ: PagedRead<never> = { rows: [], complete: true };

export type LoadedOrganisationHome = {
  organisationName: string;
  view: OrganisationHomeView;
  welcome: WelcomeCardView | null;
  roleExplanation: string;
  /** "What can I do here as an owner?" */
  roleQuestion: string;
  /** The line under the title. */
  description: string;
  /** A buyer agent's standing authority for every sale ("Your limit for every sale: £10,000"). */
  authority: string | null;
  /** Set when a list was longer than Home reads, so "Needs you" may not show everything. */
  listLimitNotice: string | null;
  /** The people who run the organisation get "Sell a work" beside the title. */
  sellHref: string | null;
};

/**
 * The line under the title: a new organisation is welcomed and told its steps; otherwise Home
 * says what it is for, in the member's terms.
 */
function homeDescription(
  model: { firstSteps: readonly unknown[] | null },
  organisationName: string,
  followsSales: boolean,
): string {
  if (model.firstSteps) {
    return `Welcome to LAX Bid. These steps get ${organisationName} ready to bid and sell.`;
  }
  return followsSales
    ? `What needs ${organisationName} this week, and how its sales are going.`
    : `What needs you at ${organisationName} this week.`;
}

/** Settles to a fallback, so one slow or refused list never blanks Home. */
function settle<T>(enabled: boolean, load: () => Promise<T>, fallback: T): Promise<T> {
  if (!enabled) return Promise.resolve(fallback);
  return load().catch(() => fallback);
}

/**
 * Loads only what the member's role may see, builds the Home model in the domain and turns it
 * into words and links. "Needs you" is the one reader's answer, the same read the sidebar counts
 * use; Home works out no task itself. Every other list degrades to empty on failure.
 */
export async function loadOrganisationHome(
  user: Pick<SessionUser, "role" | "staffRoles">,
  organisation: LegalEntitySummary,
): Promise<LoadedOrganisationHome> {
  const actor: EntityActor = {
    role: organisation.role,
    isImpersonation: organisation.isImpersonation,
  };
  const reads = (capability: EntityCapability) => entityActorCan({ role: actor.role }, capability);
  const c = await getServerDataContainer();
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const followsConsignments = reads("entity.consignments.read");

  const scope = await c.buying.scope();
  const [
    submissionRead,
    lotRead,
    unsoldRead,
    account,
    purchases,
    bids,
    members,
    stoppedBids,
    mine,
    dashboard,
    needsYou,
  ] = await Promise.all([
    settle<PagedRead<ItemSubmission>>(
      followsConsignments,
      () => readAllPages((page) => c.submissions.listMinePaged(page), LIST_PAGING),
      EMPTY_READ,
    ),
    settle<PagedRead<Lot>>(
      followsConsignments,
      () =>
        readAllPages(
          async (page) => ({
            rows: await c.sellerLots.list({ sellerId: organisation.id, ...page }),
          }),
          LIST_PAGING,
        ),
      EMPTY_READ,
    ),
    // Only the unsold lots nobody has chosen for: told to those who follow but cannot choose.
    settle<PagedRead<SellerUnsoldOutcome>>(
      followsConsignments,
      () =>
        readAllPages((page) => listServerUnsoldOutcomes({ choice: "none", ...page }), LIST_PAGING),
      EMPTY_READ,
    ),
    settle(true, () => loadSellerAccountFacts(sellerCtx), null),
    // The same reader as Purchases and Bids, so the figures and tasks match those pages.
    settle<PortfolioRow[]>(accountPurchaseScope(actor) !== null, () => c.buying.purchases(), []),
    settle<BidWithLot[]>(accountBidScope(actor) !== null, () => c.buying.bids(), []),
    settle(
      reads("entity.members.manage"),
      async () => {
        const result = await listMembersAction(organisation.id);
        return result.ok ? result.data : [];
      },
      [],
    ),
    settle(
      reads("entity.members.manage"),
      async () => (await getServerStoppedMemberBids(organisation.id)) ?? [],
      [],
    ),
    settle(
      roleBidsThroughAuthorisation(actor.role),
      () => getServerMyBuyerAgentAuthorisations(organisation.id),
      [],
    ),
    settle(true, () => getServerOrganisationDashboard(organisation.id), null),
    settle(true, () => getServerNeedsYou(organisation.id), null),
  ]);

  const submissions = submissionRead.rows;
  const lots = lotRead.rows;

  const facts: OrganisationHomeFacts = {
    actor,
    organisation: { status: organisation.status, payoutsReady: account?.payoutsReady ?? true },
    unsoldLots: unsoldRead.rows.map((outcome) => ({
      id: outcome.lotId,
      title: outcome.title,
      choice: outcome.choice,
    })),
    // The first owner is always a member; anyone else, joined or invited, means a team.
    teamInvited: members.length > 1,
  };

  const activity = homeActivityEvents({
    submissions,
    lots,
    purchases,
    members: members.map((member) => ({
      id: member.id,
      name: member.user.name || member.user.email,
      acceptedAt: member.acceptedAt ? new Date(member.acceptedAt) : null,
      invited: !member.isPrimaryAdmin,
    })),
    stoppedMemberBids: stoppedBids.map((stopped) => ({
      memberUserId: stopped.memberUserId,
      memberName: stopped.memberName,
      stoppedAt: new Date(stopped.stoppedAt),
      count: stopped.bids.length,
    })),
  });
  // Home works out the account groups itself from what it already read: the buyer agent's
  // authorisations, and the bids and purchases behind the Bids and Purchases pages.
  const groups = new Set(dashboardFigureGroupsFor(actor));
  const figures: DashboardFigures | null = dashboard
    ? {
        ...dashboard,
        ...(groups.has("bidAuthority") ? { bidAuthority: bidAuthorityFigure(mine) } : {}),
        ...(groups.has("openBids") ? { openBids: openBidsFigure(bids, scope.actor.userId) } : {}),
        ...(groups.has("purchasesToPay")
          ? { purchasesToPay: purchasesToPayFigure(purchases) }
          : {}),
      }
    : null;
  const model = buildOrganisationHome(facts, activity, figures, needsYou);
  const ctx = { organisationName: organisation.displayName, now: new Date() };

  const welcome = welcomeCardFor({
    role: actor.role,
    invited: organisation.welcomePending === true && !actor.isImpersonation,
    dismissed: false,
    identityVerified: !(needsYou?.tasks ?? []).some((task) => task.kind === "identity"),
  });

  return {
    organisationName: organisation.displayName,
    view: organisationHomeView(model, ctx),
    welcome: welcome
      ? {
          organisationId: organisation.id,
          headline: welcomeHeadline(actor.role, organisation.displayName),
          abilities: abilityPhrases(actor.role),
          identityStep: welcome.identityStep,
        }
      : null,
    roleExplanation: roleExplanation(actor.role, organisation.displayName),
    roleQuestion: roleQuestion(actor.role),
    description: homeDescription(model, organisation.displayName, followsConsignments),
    // The bid limit figure says the same; the line stands in when the figures did not load.
    authority: model.dashboard ? null : buyerAgentAuthorityLine(mine),
    listLimitNotice:
      needsYou?.truncated || ![submissionRead, lotRead, unsoldRead].every((read) => read.complete)
        ? "Some lists are longer than Home reads. Open each page to see everything."
        : null,
    sellHref: model.shortcuts.includes("sell") ? CLIENT_ROUTES.sellingNew : null,
  };
}
