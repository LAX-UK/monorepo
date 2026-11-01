import {
  type AccountFigureGroup,
  type DashboardFigureGroup,
  type DashboardFigures,
  type EntityActor,
  addMoneyStrings,
  consignedLotScope,
  consignmentProgressCounts,
  dashboardFigureGroupsFor,
  dashboardFigureScope,
  isAccountFigureGroup,
  londonCalendarYear,
  payoutTotals,
  splitPayoutDates,
  sumMoneyByCurrency,
  upcomingSaleFigures,
} from "@auction/domain";
import type {
  ConsignmentReadScope,
  CurrencyCountRow,
  DuePayoutRow,
  IConsignmentStatusCountsReader,
  IPayoutsDueReader,
  ISoldWorksReader,
  IUpcomingSaleWorksReader,
} from "@auction/persistence/interfaces";
import type { IOrganisationDashboardService } from "../interfaces/organisation-dashboard-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

/** Payouts still to arrive in one currency, with their settlement dates either side of now. */
type PayoutsDueRow = CurrencyCountRow & { nextDate: Date | null; overdueSince: Date | null };

/** One read-model port per figure group. */
export type OrganisationDashboardReaders = {
  consignmentStatus: IConsignmentStatusCountsReader;
  upcomingSaleWorks: IUpcomingSaleWorksReader;
  soldWorks: ISoldWorksReader;
  payoutsDue: IPayoutsDueReader;
};

export type OrganisationDashboardDeps = {
  readers: OrganisationDashboardReaders;
  now?: () => Date;
};

/**
 * Groups Home adds itself from what it already reads: the buyer agent's authorisations, and the
 * account's bids and purchases, which come from the same reader as the Bids and Purchases pages
 * so the figures always match them.
 */
type ServerGroup = Exclude<DashboardFigureGroup, AccountFigureGroup>;

type LoadContext = {
  actor: EntityActor;
  member: OrganisationMemberActor;
  now: Date;
};

type Loaders = {
  [G in ServerGroup]: (ctx: LoadContext) => Promise<NonNullable<DashboardFigures[G]>>;
};

/** Rows per sale and currency; far more than the few sales Home shows. */
const UPCOMING_ROWS_LIMIT = 100;

const isServerGroup = (group: DashboardFigureGroup): group is ServerGroup =>
  !isAccountFigureGroup(group);

function consignmentScope(ctx: LoadContext, group: ServerGroup): ConsignmentReadScope {
  const scope = dashboardFigureScope(ctx.actor, group);
  return {
    legalEntityId: ctx.member.legalEntityId,
    visibleTo: scope === "all" ? undefined : { scope, userId: ctx.member.userId },
    lotsSentBy: consignedLotScope(ctx.actor) === "own" ? ctx.member.userId : undefined,
  };
}

const countOf = (rows: readonly CurrencyCountRow[]) => rows.reduce((n, row) => n + row.count, 0);

const totalsOf = (rows: readonly CurrencyCountRow[]) =>
  sumMoneyByCurrency(rows.map(({ currency, amount }) => ({ currency, amount })));

/**
 * Payouts still to arrive, one row per currency. Each payout counts for what its lines come to
 * (the split the payout page shows), and the soonest date ahead is kept apart from the earliest
 * already past, so an overdue payout never hides the next one.
 */
function dueByCurrency(payouts: readonly DuePayoutRow[], now: Date): PayoutsDueRow[] {
  const byCurrency = new Map<string, PayoutsDueRow>();
  for (const due of payouts) {
    const row = byCurrency.get(due.currency) ?? {
      currency: due.currency,
      count: 0,
      amount: "0.00",
      nextDate: null,
      overdueSince: null,
    };
    row.count += 1;
    row.amount = addMoneyStrings(row.amount, payoutTotals(due.lines, due.stripeFee).net);
    const past = due.periodEnd < now;
    const key = past ? "overdueSince" : "nextDate";
    const current = row[key];
    if (!current || due.periodEnd < current) row[key] = due.periodEnd;
    byCurrency.set(due.currency, row);
  }
  return [...byCurrency.values()];
}

/**
 * Builds the figures for a member's Home: the domain decides which groups the role uses and whose
 * records each counts; each group is read once, all in parallel.
 */
export class OrganisationDashboardService implements IOrganisationDashboardService {
  private readonly now: () => Date;
  private readonly loaders: Loaders;

  constructor(deps: OrganisationDashboardDeps) {
    this.now = deps.now ?? (() => new Date());
    const { readers } = deps;
    this.loaders = {
      consignmentProgress: async (ctx) =>
        consignmentProgressCounts(
          await readers.consignmentStatus.count(consignmentScope(ctx, "consignmentProgress")),
        ),
      upcomingSales: async (ctx) =>
        upcomingSaleFigures(
          await readers.upcomingSaleWorks.list(
            consignmentScope(ctx, "upcomingSales"),
            ctx.now,
            UPCOMING_ROWS_LIMIT,
          ),
        ),
      soldThisYear: async (ctx) => {
        const year = londonCalendarYear(ctx.now);
        const rows = await readers.soldWorks.soldBetween(
          ctx.member.legalEntityId,
          year.from,
          year.to,
        );
        return { year: year.year, works: countOf(rows), totals: totalsOf(rows) };
      },
      payoutsDue: async (ctx) => {
        const rows = dueByCurrency(
          await readers.payoutsDue.listDue(ctx.member.legalEntityId),
          ctx.now,
        );
        const dates = rows.flatMap((row) =>
          [row.nextDate, row.overdueSince].filter((date): date is Date => date !== null),
        );
        return {
          payouts: countOf(rows),
          totals: totalsOf(rows),
          ...splitPayoutDates(dates, ctx.now),
        };
      },
    };
  }

  async figures(member: OrganisationMemberActor): Promise<DashboardFigures> {
    const actor: EntityActor = { role: member.role, isImpersonation: member.isImpersonation };
    const ctx: LoadContext = { actor, member, now: this.now() };
    const groups = dashboardFigureGroupsFor(actor).filter(isServerGroup);
    const entries = await Promise.all(
      groups.map(async (group) => [group, await this.loaders[group](ctx)] as const),
    );
    return Object.fromEntries(entries) as DashboardFigures;
  }
}
