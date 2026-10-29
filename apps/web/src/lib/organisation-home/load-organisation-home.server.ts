import "server-only";

import { openBidsFigure, purchasesToPayFigure } from "@/lib/buying/account-buying-figures";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import { getServerOrganisationDashboard } from "@/lib/data/http/organisation-dashboard.server";
import {
  getServerMyBuyerAgentAuthorisations,
  getServerStoppedMemberBids,
} from "@/lib/data/http/organisation-membership.server";
import { isAwaitingCheckout } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { listMembersAction } from "@/lib/legal-entity/member-management.actions";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import {
  consignmentChecklistFacts,
  personalIdentityFact,
} from "@/lib/seller/consignment-checklist-facts";
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
  computeConsignmentChecklist,
  dashboardFigureGroupsFor,
  entityActorCan,
  roleBidsThroughAuthorisation,
  roleNeedsPersonalIdentity,
  welcomeCardFor,
} from "@auction/domain";
import type {
  ConsignmentAgreement,
  ItemSubmission,
  LegalEntitySummary,
  Lot,
  PortfolioRow,
} from "@auction/types";
import { abilityPhrases, roleExplanation, welcomeHeadline } from "./member-role-copy";
import { homeActivityEvents } from "./organisation-home-activity";
import {
  type OrganisationHomeView,
  type WelcomeCardView,
  buyerAgentAuthorityLine,
  organisationHomeView,
} from "./organisation-home-view";

const PAGE_LIMIT = 100;

export type LoadedOrganisationHome = {
  organisationName: string;
  view: OrganisationHomeView;
  welcome: WelcomeCardView | null;
  roleExplanation: string;
  /** A buyer agent's standing authority for every sale ("Your limit for every sale: £10,000"). */
  authority: string | null;
};

/** Settles to a fallback, so one slow or refused list never blanks Home. */
function settle<T>(enabled: boolean, load: () => Promise<T>, fallback: T): Promise<T> {
  if (!enabled) return Promise.resolve(fallback);
  return load().catch(() => fallback);
}

/**
 * Loads only what the member's role may see, builds the Home model in the domain and turns it
 * into words and links. Every list degrades to empty on failure.
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
  const needsIdentity = roleNeedsPersonalIdentity(actor.role);

  const scope = await c.buying.scope();
  const [
    submissions,
    lots,
    agreements,
    account,
    purchases,
    bids,
    members,
    stoppedBids,
    mine,
    kyc,
    dashboard,
  ] = await Promise.all([
    settle<ItemSubmission[]>(
      followsConsignments,
      () => c.submissions.listMine({ limit: PAGE_LIMIT, offset: 0 }),
      [],
    ),
    settle<Lot[]>(
      followsConsignments,
      () => c.sellerLots.list({ sellerId: organisation.id, limit: PAGE_LIMIT }),
      [],
    ),
    settle<ConsignmentAgreement[]>(followsConsignments, listServerConsignmentAgreements, []),
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
    settle(needsIdentity, () => c.kyc.getSummary(), null),
    settle(true, () => getServerOrganisationDashboard(organisation.id), null),
  ]);

  const agreementBySubmission = new Map(agreements.map((a) => [a.submissionId, a]));
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const viewerIdentity = needsIdentity ? personalIdentityFact(kyc) : "verified";
  const payoutsReady = account?.payoutsReady ?? true;

  const facts: OrganisationHomeFacts = {
    actor,
    organisation: { status: organisation.status, payoutsReady },
    consignments: account
      ? submissions.map((submission) => ({
          id: submission.id,
          title: submission.title,
          checklist: computeConsignmentChecklist(
            consignmentChecklistFacts({
              submission,
              agreement: agreementBySubmission.get(submission.id) ?? null,
              account,
              lot: submission.convertedLotId
                ? (lotById.get(submission.convertedLotId) ?? null)
                : null,
            }),
          ),
        }))
      : [],
    changesRequested: submissions
      .filter((s) => s.status === "changes_requested")
      .map((s) => ({ id: s.id, title: s.title, note: s.changesRequestedNote ?? null })),
    // The lot list carries no unsold choice yet, so every ended lot reads as "none".
    unsoldLots: lots.map((lot) => ({
      id: lot.id,
      title: lot.title,
      status: lot.status,
      winnerId: lot.winnerId ?? null,
      choice: "none" as const,
    })),
    purchasesAwaitingPayment: purchases
      .filter(isAwaitingCheckout)
      .map(({ lot }) => ({ id: lot.id, title: lot.title })),
    viewerIdentity,
    salesToRegister: mine.flatMap((authorisation) =>
      authorisation.sale && !authorisation.sale.registered
        ? [
            {
              id: authorisation.sale.id,
              title: authorisation.sale.title,
              startsAt: new Date(authorisation.sale.startTime),
              bidLimit: authorisation.bidLimit,
            },
          ]
        : [],
    ),
    hasWorkAwaitingPayout:
      lots.length > 0 ||
      submissions.some((s) => s.status === "approved" || s.status === "converted"),
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
  const model = buildOrganisationHome(facts, activity, figures);
  const ctx = { organisationName: organisation.displayName };

  const welcome = welcomeCardFor({
    role: actor.role,
    invited: organisation.welcomePending === true && !actor.isImpersonation,
    dismissed: false,
    identityVerified: viewerIdentity === "verified",
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
    // The bid limit figure says the same; the line stands in when the figures did not load.
    authority: model.dashboard ? null : buyerAgentAuthorityLine(mine),
  };
}
