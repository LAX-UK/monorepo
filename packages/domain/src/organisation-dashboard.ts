import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import {
  CONSIGNMENT_PROGRESS_STAGES,
  type ConsignmentProgressCounts,
  type ConsignmentProgressStage,
  consignmentsInProgress,
} from "./consignment-progress.js";
import { type EntityActor, type EntityCapability, entityActorCan } from "./entity-capabilities.js";
import { type EstimateTotal, type MoneyTotal, sumEstimatesByCurrency } from "./money-totals.js";
import { type SubmissionSenderScope, submissionSenderScope } from "./submission-visibility.js";

/** One upcoming sale with some of the organisation's works in it. */
export type UpcomingSaleFigure = {
  id: string;
  title: string;
  startsAt: Date;
  works: number;
  /** Estimate totals per currency, over the works that have an estimate. */
  estimates: EstimateTotal[];
};

/** A buyer agent's standing to bid for the organisation. */
export type BidAuthorityFigure = {
  /** Authorised for every sale, with its limit (`null` means no limit). */
  everySale: { limit: string | null } | null;
  /** Upcoming sales authorised one by one. */
  sales: ReadonlyArray<{
    id: string;
    title: string;
    startsAt: Date;
    limit: string | null;
    registered: boolean;
  }>;
};

/**
 * The business figures behind Home, one entry per figure group. A group is loaded only for roles
 * that use it, so the others stay absent.
 */
/**
 * Splits scheduled payout dates at `now`: the soonest one still ahead and the earliest one
 * already past (overdue). A past date is never offered as the next one.
 */
export function splitPayoutDates(
  dates: readonly Date[],
  now: Date,
): { nextDate: Date | null; overdueSince: Date | null } {
  const times = dates.map((date) => date.getTime());
  const ahead = times.filter((time) => time >= now.getTime());
  const past = times.filter((time) => time < now.getTime());
  return {
    nextDate: ahead.length > 0 ? new Date(Math.min(...ahead)) : null,
    overdueSince: past.length > 0 ? new Date(Math.min(...past)) : null,
  };
}

export type DashboardFigures = {
  /** The organisation's works in progress, by stage. */
  consignmentProgress?: ConsignmentProgressCounts;
  /** Upcoming sales with the organisation's works, soonest first. */
  upcomingSales?: UpcomingSaleFigure[];
  /** Works sold in the calendar year (UK time), with hammer totals per currency. */
  soldThisYear?: { year: number; works: number; totals: MoneyTotal[] };
  /**
   * Payouts scheduled or on their way. `nextDate` is the soonest date still ahead;
   * `overdueSince` is the earliest date already past, so a past date is never shown as upcoming.
   */
  payoutsDue?: {
    payouts: number;
    totals: MoneyTotal[];
    nextDate: Date | null;
    overdueSince: Date | null;
  };
  /** Lots still open with the organisation's bids, and the most it could pay per currency. */
  openBids?: { lots: number; totalMax: MoneyTotal[] };
  /** Won lots not paid yet, with what is owed per currency. */
  purchasesToPay?: { purchases: number; totals: MoneyTotal[] };
  /** A buyer agent's authorisations. */
  bidAuthority?: BidAuthorityFigure;
};

export type DashboardFigureGroup = keyof DashboardFigures;

/** Reading capabilities count for an impersonating admin too; Home only shows figures. */
const reads = (actor: EntityActor, name: EntityCapability) =>
  entityActorCan({ role: actor.role }, name);

/**
 * Whose records a figure group counts.
 * - Consignment groups follow the submission rule: a consignor sees what they sent.
 * - Sold works and payouts settle the whole organisation, so they are never narrowed.
 * - Bids: members who bid without an authorisation see the organisation's; agents see their own.
 */
const GROUP_SCOPE: Record<DashboardFigureGroup, (actor: EntityActor) => SubmissionSenderScope> = {
  consignmentProgress: submissionSenderScope,
  upcomingSales: submissionSenderScope,
  soldThisYear: () => "all",
  payoutsDue: () => "all",
  openBids: (a) => (reads(a, "entity.bid.place_without_authorisation") ? "all" : "own"),
  purchasesToPay: () => "all",
  bidAuthority: () => "own",
};

export function dashboardFigureScope(
  actor: EntityActor,
  group: DashboardFigureGroup,
): SubmissionSenderScope {
  return GROUP_SCOPE[group](actor);
}

type GroupCheck = {
  [G in DashboardFigureGroup]: (figure: NonNullable<DashboardFigures[G]>) => boolean;
};

/** When a group has nothing in it. */
const GROUP_EMPTY: GroupCheck = {
  consignmentProgress: (counts) => consignmentsInProgress(counts) === 0,
  upcomingSales: (sales) => sales.length === 0,
  soldThisYear: (sold) => sold.works === 0,
  payoutsDue: (due) => due.payouts === 0,
  openBids: (bids) => bids.lots === 0,
  purchasesToPay: (owed) => owed.purchases === 0,
  bidAuthority: (authority) => authority.everySale === null && authority.sales.length === 0,
};

function groupEmpty<G extends DashboardFigureGroup>(
  group: G,
  figure: NonNullable<DashboardFigures[G]>,
): boolean {
  return (GROUP_EMPTY[group] as (figure: NonNullable<DashboardFigures[G]>) => boolean)(figure);
}

/** How a buyer agent's limit reads: one amount, the highest of several, or none at all. */
export type BidLimitSummary =
  | { kind: "not_authorised" }
  | { kind: "unlimited"; scope: "every_sale" | "sales" }
  | { kind: "amount"; amount: string; scope: "every_sale" | "sales"; varies: boolean };

/** The figure tiles under "At a glance". Each knows when it has nothing to show. */
export type DashboardTile =
  | {
      kind: "works_by_stage";
      empty: boolean;
      /** Only the member's own submissions are counted. */
      own: boolean;
      total: number;
      /** The two busiest stages, largest first. */
      busiest: { stage: ConsignmentProgressStage; count: number }[];
    }
  | {
      kind: "in_upcoming_sales";
      empty: boolean;
      own: boolean;
      works: number;
      estimates: EstimateTotal[];
    }
  | { kind: "sold_this_year"; empty: boolean; year: number; works: number; totals: MoneyTotal[] }
  | {
      kind: "payouts_due";
      empty: boolean;
      payouts: number;
      totals: MoneyTotal[];
      nextDate: Date | null;
      overdueSince: Date | null;
    }
  | { kind: "open_bids"; empty: boolean; own: boolean; lots: number; totalMax: MoneyTotal[] }
  | { kind: "purchases_to_pay"; empty: boolean; purchases: number; totals: MoneyTotal[] }
  | { kind: "bid_limit"; empty: boolean; limit: BidLimitSummary }
  | {
      kind: "authorised_sales";
      empty: boolean;
      everySale: boolean;
      sales: number;
      toRegister: number;
    };

export type DashboardTileKind = DashboardTile["kind"];

function busiestStages(counts: ConsignmentProgressCounts) {
  return CONSIGNMENT_PROGRESS_STAGES.map((stage) => ({ stage, count: counts[stage] }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
}

function highest(limits: readonly string[]): string {
  return limits.reduce((top, limit) => (Number(limit) > Number(top) ? limit : top));
}

export function bidLimitSummary(authority: BidAuthorityFigure): BidLimitSummary {
  if (authority.everySale) {
    const { limit } = authority.everySale;
    return limit === null
      ? { kind: "unlimited", scope: "every_sale" }
      : { kind: "amount", amount: limit, scope: "every_sale", varies: false };
  }
  const limits = authority.sales.map((sale) => sale.limit);
  if (limits.length === 0) return { kind: "not_authorised" };
  if (limits.some((limit) => limit === null)) return { kind: "unlimited", scope: "sales" };
  const amounts = limits as string[];
  const varies = new Set(amounts.map(Number)).size > 1;
  return { kind: "amount", amount: highest(amounts), scope: "sales", varies };
}

type TileSpec<G extends DashboardFigureGroup> = {
  kind: DashboardTileKind;
  group: G;
  applies: (actor: EntityActor) => boolean;
  /** `own` is set when the figure counts only the member's own records. */
  build: (figure: NonNullable<DashboardFigures[G]>, own: boolean) => DashboardTile;
};

function tile<G extends DashboardFigureGroup>(spec: TileSpec<G>): TileSpec<DashboardFigureGroup> {
  return spec as unknown as TileSpec<DashboardFigureGroup>;
}

/**
 * "At a glance", in order; the first four that apply to the role are shown.
 * - Owner, admin: in upcoming sales, sold this year, payouts due, open bids.
 * - Finance: sold this year, payouts due, purchases to pay.
 * - Consignor: their works by stage, their works in upcoming sales.
 * - Buyer agent: their open bids, their limit, the sales they may bid in.
 * - Viewer: consignments by stage.
 */
const TILE_SPECS: readonly TileSpec<DashboardFigureGroup>[] = [
  tile({
    // People who follow consignments without settling them.
    kind: "works_by_stage",
    group: "consignmentProgress",
    applies: (a) => reads(a, "entity.consignments.read") && !reads(a, "entity.payouts.read"),
    build: (counts, own) => {
      const total = consignmentsInProgress(counts);
      return {
        kind: "works_by_stage",
        empty: total === 0,
        own,
        total,
        busiest: busiestStages(counts),
      };
    },
  }),
  tile({
    kind: "in_upcoming_sales",
    group: "upcomingSales",
    applies: (a) => reads(a, "entity.submissions.create"),
    build: (sales, own) => {
      const works = sales.reduce((sum, sale) => sum + sale.works, 0);
      return {
        kind: "in_upcoming_sales",
        empty: works === 0,
        own,
        works,
        estimates: sumEstimatesByCurrency(sales.flatMap((sale) => sale.estimates)),
      };
    },
  }),
  tile({
    kind: "sold_this_year",
    group: "soldThisYear",
    applies: (a) => reads(a, "entity.payouts.read"),
    build: (sold) => ({ kind: "sold_this_year", empty: sold.works === 0, ...sold }),
  }),
  tile({
    kind: "payouts_due",
    group: "payoutsDue",
    applies: (a) => reads(a, "entity.payouts.read"),
    build: (due) => ({ kind: "payouts_due", empty: due.payouts === 0, ...due }),
  }),
  tile({
    kind: "open_bids",
    group: "openBids",
    applies: (a) => reads(a, "entity.bid.place"),
    build: (bids, own) => ({ kind: "open_bids", empty: bids.lots === 0, own, ...bids }),
  }),
  tile({
    // Finance pays; the people who run the organisation see purchases in "Needs you".
    kind: "purchases_to_pay",
    group: "purchasesToPay",
    applies: (a) => reads(a, "entity.finance.write") && !reads(a, "entity.members.manage"),
    build: (owed) => ({ kind: "purchases_to_pay", empty: owed.purchases === 0, ...owed }),
  }),
  tile({
    kind: "bid_limit",
    group: "bidAuthority",
    applies: (a) => roleBidsThroughAuthorisation(a.role),
    build: (authority) => {
      const limit = bidLimitSummary(authority);
      return { kind: "bid_limit", empty: limit.kind === "not_authorised", limit };
    },
  }),
  tile({
    kind: "authorised_sales",
    group: "bidAuthority",
    applies: (a) => roleBidsThroughAuthorisation(a.role),
    build: (authority) => ({
      kind: "authorised_sales",
      empty: authority.everySale === null && authority.sales.length === 0,
      everySale: authority.everySale !== null,
      sales: authority.sales.length,
      toRegister: authority.sales.filter((sale) => !sale.registered).length,
    }),
  }),
];

const MAX_TILES = 4;

/** The sections below "At a glance". Shortcuts are for the people who run the organisation. */
export type DashboardSection = "upcoming_sales" | "consignment_progress";

type SectionSpec = {
  section: DashboardSection;
  group: DashboardFigureGroup;
  applies: (actor: EntityActor) => boolean;
};

const SECTION_SPECS: readonly SectionSpec[] = [
  {
    section: "upcoming_sales",
    group: "upcomingSales",
    applies: (a) => reads(a, "entity.consignments.read"),
  },
  {
    section: "consignment_progress",
    group: "consignmentProgress",
    applies: (a) => reads(a, "entity.consignments.read"),
  },
];

/** The next sales shown on Home; the rest are one click away. */
const UPCOMING_SALES_LIMIT = 4;

/** What a new organisation is pointed to instead of empty figures. */
export type FirstRunAction = "sell" | "invite";

const FIRST_RUN_ACTIONS: readonly { action: FirstRunAction; capability: EntityCapability }[] = [
  { action: "sell", capability: "entity.submissions.create" },
  { action: "invite", capability: "entity.members.manage" },
];

function tileSpecsFor(actor: EntityActor) {
  return TILE_SPECS.filter((spec) => spec.applies(actor)).slice(0, MAX_TILES);
}

function sectionSpecsFor(actor: EntityActor) {
  return SECTION_SPECS.filter((spec) => spec.applies(actor));
}

/** The figure groups a role's Home reads, so nothing else is loaded. */
export function dashboardFigureGroupsFor(actor: EntityActor): DashboardFigureGroup[] {
  const groups = [...tileSpecsFor(actor), ...sectionSpecsFor(actor)].map((spec) => spec.group);
  return [...new Set(groups)];
}

/** The tile kinds a role sees, in order. */
export function dashboardTileKindsFor(actor: EntityActor): DashboardTileKind[] {
  return tileSpecsFor(actor).map((spec) => spec.kind);
}

/** The sections a role can see when they have something in them. */
export function dashboardSectionsFor(actor: EntityActor): DashboardSection[] {
  return sectionSpecsFor(actor).map((spec) => spec.section);
}

export type OrganisationDashboardModel = {
  /** Set when there is nothing yet: Home points to the first steps instead of empty figures. */
  firstRun: { actions: FirstRunAction[] } | null;
  tiles: DashboardTile[];
  /** The next few sales, or empty when the section is hidden. */
  upcomingSales: UpcomingSaleFigure[];
  /** Works by stage, or `null` when the section is hidden. */
  progress: ConsignmentProgressCounts | null;
};

function isFirstRun(actor: EntityActor, figures: DashboardFigures): boolean {
  return dashboardFigureGroupsFor(actor).every((group) => {
    const figure = figures[group];
    return figure !== undefined && groupEmpty(group, figure);
  });
}

/**
 * The business dashboard for one member, from figures alone. Tasks stay first on Home; this is
 * what follows: up to four figures, the next sales and works by stage, each only when the role
 * may see it. A new organisation with nothing yet gets its first steps instead.
 */
export function buildOrganisationDashboard(
  actor: EntityActor,
  figures: DashboardFigures,
): OrganisationDashboardModel {
  if (isFirstRun(actor, figures)) {
    return {
      firstRun: {
        actions: FIRST_RUN_ACTIONS.filter(({ capability }) =>
          entityActorCan(actor, capability),
        ).map(({ action }) => action),
      },
      tiles: [],
      upcomingSales: [],
      progress: null,
    };
  }
  const tiles = tileSpecsFor(actor).flatMap((spec) => {
    const figure = figures[spec.group];
    const own = dashboardFigureScope(actor, spec.group) === "own";
    return figure === undefined ? [] : [spec.build(figure, own)];
  });
  const sections = new Set(dashboardSectionsFor(actor));
  const progress = figures.consignmentProgress;
  return {
    firstRun: null,
    tiles,
    upcomingSales: sections.has("upcoming_sales")
      ? (figures.upcomingSales ?? []).slice(0, UPCOMING_SALES_LIMIT)
      : [],
    progress:
      sections.has("consignment_progress") && progress && consignmentsInProgress(progress) > 0
        ? progress
        : null,
  };
}

/** A buyer agent's authorisation in force, as their own list reports it. */
export type AuthorisationInForce = {
  sale: { id: string; title: string; startTime: string; registered: boolean } | null;
  bidLimit: string | null;
};

/** The bid authority figure from the agent's authorisations in force. */
export function bidAuthorityFigure(
  authorisations: readonly AuthorisationInForce[],
): BidAuthorityFigure {
  const everySale = authorisations.find((a) => a.sale === null);
  return {
    everySale: everySale ? { limit: everySale.bidLimit } : null,
    sales: authorisations.flatMap(({ sale, bidLimit }) =>
      sale
        ? [
            {
              id: sale.id,
              title: sale.title,
              startsAt: new Date(sale.startTime),
              limit: bidLimit,
              registered: sale.registered,
            },
          ]
        : [],
    ),
  };
}

/** One row per sale and currency, as the upcoming-sales read model returns it. */
export type UpcomingSaleRow = {
  saleId: string;
  title: string;
  startsAt: Date;
  currency: string;
  works: number;
  /** Works in this row with an estimate, and their estimate totals. */
  estimatedWorks: number;
  estimateLow: string;
  estimateHigh: string;
};

/** Folds per-currency rows into one figure per sale, soonest first. */
export function upcomingSaleFigures(rows: readonly UpcomingSaleRow[]): UpcomingSaleFigure[] {
  const bySale = new Map<string, UpcomingSaleFigure & { rows: UpcomingSaleRow[] }>();
  for (const row of rows) {
    const sale = bySale.get(row.saleId) ?? {
      id: row.saleId,
      title: row.title,
      startsAt: row.startsAt,
      works: 0,
      estimates: [],
      rows: [],
    };
    sale.works += row.works;
    sale.rows.push(row);
    bySale.set(row.saleId, sale);
  }
  return [...bySale.values()]
    .map(({ rows: saleRows, ...sale }) => ({
      ...sale,
      estimates: sumEstimatesByCurrency(
        saleRows
          .filter((row) => row.estimatedWorks > 0)
          .map((row) => ({ currency: row.currency, low: row.estimateLow, high: row.estimateHigh })),
      ),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
