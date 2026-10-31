import {
  type EntityActor,
  type NeedsYouFacts,
  type NeedsYouKind,
  UNSOLD_LOT_END_STATUSES,
  accountBidScope,
  accountPurchaseScope,
  entityActorCan,
  needsYouCounts,
  needsYouKindsFor,
  needsYouLink,
  needsYouTasks,
  needsYouWindows,
  submissionSenderScope,
} from "@auction/domain";
import type {
  INeedsYouFactsReader,
  IUnsoldLotChoiceReader,
  SubmissionSenderFilter,
} from "@auction/persistence/interfaces";
import type { IMyBuyerAgentAuthorisationsService } from "../buyer-agents/my-buyer-agent-authorisations.service.js";
import type { IUnsoldChoiceDeadlines } from "../consignment-after-sale/unsold-choice-deadlines.js";
import type {
  INeedsYouOrganisationReader,
  INeedsYouService,
  NeedsYouView,
} from "../interfaces/needs-you-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

/** Rows read per list; far more than one member acts on at once. */
const LIST_LIMIT = 100;

export type NeedsYouServiceDeps = {
  facts: INeedsYouFactsReader;
  organisations: INeedsYouOrganisationReader;
  unsold: Pick<IUnsoldLotChoiceReader, "listUnsoldOutcomes">;
  /** The stored date each unsold choice is due by. */
  deadlines: IUnsoldChoiceDeadlines;
  authorisations: IMyBuyerAgentAuthorisationsService;
  now?: () => Date;
};

const NOTHING: NeedsYouView = {
  kinds: [],
  tasks: [],
  counts: { bids: 0, purchases: 0, consignments: 0, team: 0, organisation: 0 },
  truncated: false,
};

/** A read that only happens when one of the kinds needing it can be asked of this member. */
function when<T>(needed: boolean, read: () => Promise<T>, empty: T): Promise<T> {
  return needed ? read() : Promise.resolve(empty);
}

/**
 * Reads only the facts behind the kinds this member can be asked for, each narrowed the way its
 * list is (a buyer agent's own bids and wins, a consignor's own submissions), and lets the domain
 * table decide the tasks, their order, links and counts.
 */
export class NeedsYouService implements INeedsYouService {
  private readonly now: () => Date;

  constructor(private readonly deps: NeedsYouServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async read(member: OrganisationMemberActor): Promise<NeedsYouView> {
    const actor: EntityActor = { role: member.role, isImpersonation: member.isImpersonation };
    const kinds = needsYouKindsFor(actor);
    if (kinds.length === 0) return NOTHING;
    const standing = await this.deps.organisations.standing(member.legalEntityId);
    if (!standing) return NOTHING;

    const { facts, truncated } = await this.loadFacts(member, actor, new Set(kinds), standing);
    const tasks = needsYouTasks(facts);
    return {
      kinds,
      tasks: tasks.map((task) => ({ ...task, link: needsYouLink(task, actor) })),
      counts: needsYouCounts(tasks),
      truncated,
    };
  }

  private async loadFacts(
    member: OrganisationMemberActor,
    actor: EntityActor,
    kinds: ReadonlySet<NeedsYouKind>,
    organisation: NeedsYouFacts["organisation"],
  ): Promise<{ facts: NeedsYouFacts; truncated: boolean }> {
    const now = this.now();
    const windows = needsYouWindows(now);
    const any = (...wanted: NeedsYouKind[]) => wanted.some((kind) => kinds.has(kind));
    const legalEntityId = member.legalEntityId;
    const bidScope = accountBidScope(actor);
    const purchaseScope = accountPurchaseScope(actor);
    const senderScope = submissionSenderScope(actor);
    const visibleTo: SubmissionSenderFilter | undefined =
      senderScope === "all" ? undefined : { scope: senderScope, userId: member.userId };
    const managesAgents = entityActorCan(actor, "entity.buyer_agents.manage");
    const purchaseKinds: NeedsYouKind[] = [
      "pay",
      "won_awaiting_payment",
      "choose_delivery",
      "quote_ready",
      "book_collection",
    ];

    const [
      outbidLots,
      purchases,
      agreementsToAccept,
      changesRequested,
      unsold,
      registrations,
      endingAuthorisations,
      expiredInvitations,
      pendingAccessRequests,
      checks,
    ] = await Promise.all([
      when(
        any("outbid") && bidScope !== null,
        () =>
          this.deps.facts.outbidLots({
            legalEntityId,
            bidderId: bidScope === "own" ? member.userId : null,
            now,
            limit: LIST_LIMIT,
          }),
        [],
      ),
      when(
        any(...purchaseKinds) && purchaseScope !== null,
        () =>
          this.deps.facts.openPurchases({
            legalEntityId,
            winnerId: purchaseScope === "own" ? member.userId : null,
            limit: LIST_LIMIT,
          }),
        [],
      ),
      when(
        any("agreement"),
        () => this.deps.facts.agreementsToAccept({ legalEntityId, visibleTo, limit: LIST_LIMIT }),
        [],
      ),
      when(
        any("changes"),
        () => this.deps.facts.changesRequested({ legalEntityId, visibleTo, limit: LIST_LIMIT }),
        [],
      ),
      when(
        any("unsold", "unsold_due"),
        () =>
          this.deps.unsold.listUnsoldOutcomes({
            legalEntityId,
            endedStatuses: UNSOLD_LOT_END_STATUSES,
            visibleTo,
            choice: "none",
            limit: LIST_LIMIT,
            offset: 0,
          }),
        { rows: [], total: 0 },
      ),
      when(
        any("register"),
        () =>
          this.deps.authorisations.list({
            userId: member.userId,
            legalEntityId,
            role: member.role,
          }),
        [],
      ),
      when(
        any("authorisation_ending"),
        () =>
          this.deps.facts.endingAuthorisations({
            legalEntityId,
            userId: managesAgents ? null : member.userId,
            now,
            until: windows.authorisationsEndingBy,
          }),
        [],
      ),
      when(
        any("invitations_expired"),
        () =>
          this.deps.facts.expiredInvitations({
            legalEntityId,
            since: windows.invitationsExpiredSince,
            now,
          }),
        [],
      ),
      when(
        any("access_requests"),
        () => this.deps.facts.pendingAccessRequests({ legalEntityId, limit: LIST_LIMIT }),
        [],
      ),
      when(any("identity", "source_of_funds"), () => this.deps.facts.viewerChecks(member.userId), {
        identity: "verified" as const,
        sourceOfFundsRequested: false,
      }),
    ]);

    const dueBy = this.deps.deadlines.chooseByFor(unsold.rows);
    const facts: NeedsYouFacts = {
      actor,
      organisation,
      now,
      viewerIdentity: checks.identity,
      sourceOfFundsRequested: checks.sourceOfFundsRequested,
      agreementsToAccept,
      changesRequested,
      unsoldLots: unsold.rows.map((row) => ({
        id: row.lotId,
        title: row.title,
        dueBy: dueBy.get(row.lotId) ?? null,
      })),
      purchases,
      salesToRegister: registrations.flatMap((authorisation) =>
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
      outbidLots,
      expiredInvitations,
      endingAuthorisations,
      pendingAccessRequests,
    };
    const truncated =
      [outbidLots, purchases, agreementsToAccept, changesRequested].some(
        (rows) => rows.length >= LIST_LIMIT,
      ) || unsold.total > unsold.rows.length;
    return { facts, truncated };
  }
}
