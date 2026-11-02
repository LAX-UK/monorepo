import { CLIENT_ROUTES, teamHref } from "@/lib/navigation/client-routes";
import { organisationFirstRunCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { formatDateInline, formatKpiMoney, formatMoney } from "@/lib/ui/format";
import {
  CONSIGNMENT_PROGRESS_STAGES,
  type DashboardTile,
  type EstimateTotal,
  type FirstRunAction,
  type FirstRunAddressee,
  type MoneyTotal,
  type OrganisationDashboardModel,
  type OrganisationHomeFirstRunKey,
  type UpcomingSaleFigure,
} from "@auction/domain";
import { salePath } from "@auction/types";
import { CONSIGNMENT_STAGE_LABEL, consignmentStageHref } from "./consignment-stage-links";

/** One figure under "At a glance"; the whole tile links to the page behind it. */
export type DashboardTileView = {
  id: DashboardTile["kind"];
  label: string;
  /** The main figure: one line per currency, never mixed. Empty when the tile has nothing. */
  figures: string[];
  /** Said plainly when there is nothing to show, instead of a zero. */
  emptyText: string | null;
  /** Supporting lines under the figure; one per currency where they carry money. */
  supporting: string[];
  /** Read to assistive technology with the tile: what exactly the figure counts. */
  description: string;
  href: string;
};

export type UpcomingSaleView = {
  id: string;
  title: string;
  /** When it opens, or while it is live when it closes: "Closes 3 Nov, 21:14". */
  timing: string;
  /** The moment `timing` names, for the `time` element. */
  dateTime: string;
  /** Open for bidding now: the card says so. */
  live: boolean;
  works: string;
  /** The organisation's works in the sale, shown on the card's mat; may be empty. */
  images: string[];
  href: string;
};

export type ConsignmentStageView = {
  id: string;
  label: string;
  count: number;
  /** A stage with no works stays in the row, quietly. */
  empty: boolean;
  /** The Consignments list filtered to this stage. */
  href: string;
};

export type FirstRunView = {
  /** Whom the steps address; a member's own empty Home stays quiet, without a large drawing. */
  addressee: FirstRunAddressee;
  title: string;
  description: string;
  actions: { id: FirstRunAction; label: string; href: string }[];
};

export type OrganisationDashboardView = {
  firstRun: FirstRunView | null;
  tiles: DashboardTileView[];
  upcomingSales: UpcomingSaleView[];
  upcomingSalesHref: string;
  stages: ConsignmentStageView[] | null;
};

type Ctx = { organisationName: string };

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;

const money = (totals: readonly MoneyTotal[]) =>
  totals.map((total) => formatMoney(total.amount, total.currency));

/** Estimates read in whole units, as a catalogue prints them ("£18,000–£26,000"). */
const estimateRange = (estimate: EstimateTotal) =>
  `${formatKpiMoney(estimate.low, estimate.currency)}–${formatKpiMoney(estimate.high, estimate.currency)}`;

/**
 * A payout past its date is LAX's to settle, so it is never called overdue: it reads as delayed,
 * with the next expected date when there is one ("Delayed · we're on it · next 4 Nov 2026").
 */
function payoutDatesLine(overdueSince: Date | null, nextDate: Date | null): string[] {
  if (overdueSince) {
    const expected = nextDate ? ` · next ${formatDateInline(nextDate)}` : "";
    return [`Delayed · we're on it${expected}`];
  }
  return nextDate ? [`Next on ${formatDateInline(nextDate)}`] : [];
}

type TileViewBuilder<K extends DashboardTile["kind"]> = (
  tile: Extract<DashboardTile, { kind: K }>,
  ctx: Ctx,
) => Omit<DashboardTileView, "id" | "figures" | "emptyText"> & {
  figures: string[];
  emptyText: string;
};

/** Words and the link for every kind of tile; one entry per kind. */
const TILE_VIEWS: { [K in DashboardTile["kind"]]: TileViewBuilder<K> } = {
  works_by_stage: (tile) => ({
    label: tile.own ? "Your works in progress" : "Works in progress",
    figures: [plural(tile.total, "work")],
    supporting:
      tile.busiest.length > 0
        ? [
            tile.busiest
              .map(({ stage, count }) => `${count} ${CONSIGNMENT_STAGE_LABEL[stage].toLowerCase()}`)
              .join(" · "),
          ]
        : [],
    emptyText: "No works in progress",
    description: `${tile.own ? "Works you sent" : "Works"}, from first review to sale. Drafts and closed works are not counted.`,
    href: CLIENT_ROUTES.consignments,
  }),
  in_upcoming_sales: (tile) => ({
    label: "In upcoming sales",
    figures: [plural(tile.works, "work")],
    supporting:
      tile.estimates.length > 0
        ? tile.estimates.map((estimate) => `Est. ${estimateRange(estimate)}`)
        : ["Estimates to follow"],
    emptyText: "No works in a sale yet",
    description: `${tile.own ? "Works you sent" : "Works"} in sales that have not ended, with their combined estimates.`,
    href: consignmentStageHref("in_sale"),
  }),
  sold_this_year: (tile) => ({
    label: "Sold this year",
    figures: money(tile.totals),
    supporting: [`${plural(tile.works, "work")} since 1 Jan`],
    emptyText: "Nothing sold yet this year",
    description: `Hammer prices of works sold from 1 January to 31 December ${tile.year}, UK time.`,
    href: consignmentStageHref("sold"),
  }),
  payouts_due: (tile) => ({
    label: "Payouts due",
    figures: money(tile.totals),
    // A date already past is never offered as the next one; it reads as overdue instead.
    supporting: payoutDatesLine(tile.overdueSince, tile.nextDate),
    emptyText: "No payouts due",
    description: "Payouts scheduled or on their way to the bank account, after fees.",
    href: CLIENT_ROUTES.payouts,
  }),
  open_bids: (tile, ctx) => ({
    label: "Open bids",
    figures: [plural(tile.lots, "lot")],
    supporting: money(tile.totalMax).map((amount) => `Up to ${amount}`),
    emptyText: "No open bids",
    description: tile.own
      ? `Lots still open where you've bid for ${ctx.organisationName}, and the most you've committed on each: your highest bid, automatic bid or absentee maximum.`
      : `Lots still open with bids for ${ctx.organisationName}, and the most it could pay on each: the highest bid, automatic bid or absentee maximum.`,
    href: CLIENT_ROUTES.bids,
  }),
  purchases_to_pay: (tile) => ({
    label: "Purchases to pay",
    figures: money(tile.totals),
    supporting: [plural(tile.purchases, "purchase")],
    emptyText: "Nothing to pay",
    description: "Won lots awaiting payment, with the buyer's premium.",
    href: CLIENT_ROUTES.purchases,
  }),
  bid_limit: (tile) => {
    const { limit } = tile;
    const figure =
      limit.kind === "amount"
        ? formatMoney(limit.amount)
        : limit.kind === "unlimited"
          ? "No limit"
          : "";
    const supporting =
      limit.kind === "not_authorised"
        ? null
        : limit.scope === "every_sale"
          ? "In every sale"
          : limit.kind === "amount" && limit.varies
            ? "Your highest; it varies by sale"
            : "In the sales you're authorised for";
    return {
      label: "Your bid limit",
      figures: figure ? [figure] : [],
      supporting: supporting ? [supporting] : [],
      emptyText: "Not authorised yet",
      description: "The most you may bid for the organisation, set by its owners.",
      href: CLIENT_ROUTES.bids,
    };
  },
  authorised_sales: (tile) => ({
    label: "Sales you can bid in",
    figures: [tile.everySale ? "Every sale" : plural(tile.sales, "sale")],
    supporting: [
      tile.toRegister > 0
        ? `${plural(tile.toRegister, "sale")} to register for`
        : tile.sales > 0
          ? "Registered for all"
          : "Register for each sale you join",
    ],
    emptyText: "No sales yet",
    description: "Upcoming sales you're authorised to bid in for the organisation.",
    href: "/sales?filter=scheduled",
  }),
};

export function dashboardTileView(tile: DashboardTile, ctx: Ctx): DashboardTileView {
  const build = TILE_VIEWS[tile.kind] as TileViewBuilder<typeof tile.kind>;
  const view = build(tile as never, ctx);
  return {
    id: tile.kind,
    ...view,
    figures: tile.empty ? [] : view.figures,
    emptyText: tile.empty ? view.emptyText : null,
    supporting: tile.empty ? [] : view.supporting,
  };
}

/** Sale times are UK time, the same on the server and in every browser. */
const SALE_TIME = { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" } as const;
const OPENS_AT = new Intl.DateTimeFormat("en-GB", {
  ...SALE_TIME,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const CLOSES_AT = new Intl.DateTimeFormat("en-GB", {
  ...SALE_TIME,
  day: "numeric",
  month: "short",
});

/** A live sale says when it closes; one still to open says when it opens. */
function saleTiming(sale: UpcomingSaleFigure): Pick<UpcomingSaleView, "timing" | "dateTime"> {
  return sale.live
    ? { timing: `Closes ${CLOSES_AT.format(sale.endsAt)}`, dateTime: sale.endsAt.toISOString() }
    : { timing: `Opens ${OPENS_AT.format(sale.startsAt)}`, dateTime: sale.startsAt.toISOString() };
}

function upcomingSaleView(sale: UpcomingSaleFigure, own: boolean): UpcomingSaleView {
  const works = sale.works.toLocaleString("en-GB");
  return {
    id: sale.id,
    title: sale.title,
    ...saleTiming(sale),
    live: sale.live,
    // "Your works" for a member who sees only what they sent; the organisation's otherwise.
    works: own ? `${works} of your works` : `${works} ${sale.works === 1 ? "work" : "works"}`,
    images: sale.images,
    href: salePath({ id: sale.id, title: sale.title }),
  };
}

const FIRST_RUN_ACTION: Record<FirstRunAction, { label: string; href: string }> = {
  sell: { label: "Sell a work", href: CLIENT_ROUTES.sellingNew },
  invite: { label: "Invite someone", href: teamHref() },
};

/** First steps: the words follow the organisation's state, then the first thing the role can do. */
function firstRunView(
  { actions, shows, addressee }: NonNullable<OrganisationDashboardModel["firstRun"]>,
  key: OrganisationHomeFirstRunKey,
  ctx: Ctx,
): FirstRunView {
  return {
    addressee,
    ...organisationFirstRunCopy({ key, step: actions[0] ?? "none", addressee, shows }, ctx),
    actions: actions.map((id) => ({ id, ...FIRST_RUN_ACTION[id] })),
  };
}

/** The dashboard's words and links, from the domain model. */
export function organisationDashboardView(
  model: OrganisationDashboardModel,
  ctx: Ctx,
  firstRunKey: OrganisationHomeFirstRunKey,
): OrganisationDashboardView {
  const { progress } = model;
  const tiles = model.tiles.map((tile) => dashboardTileView(tile, ctx));
  return {
    firstRun: model.firstRun ? firstRunView(model.firstRun, firstRunKey, ctx) : null,
    // Thin data: a row of "No …" cells says nothing, so the figures show from the first one.
    tiles: tiles.some((tile) => tile.figures.length > 0) ? tiles : [],
    upcomingSales: model.upcomingSales.map((sale) => upcomingSaleView(sale, model.ownWorks)),
    upcomingSalesHref: consignmentStageHref("in_sale"),
    stages: progress ? stageViews(progress) : null,
  };
}

/**
 * Every stage in pipeline order, so the row always has the same six cells and a stage is found
 * in the same place each time; those with nothing in them are marked quiet. Each opens the
 * filtered list. `progress` is already `null` when the member has no works in progress.
 */
function stageViews(
  progress: NonNullable<OrganisationDashboardModel["progress"]>,
): ConsignmentStageView[] {
  return CONSIGNMENT_PROGRESS_STAGES.map(
    (stage): ConsignmentStageView => ({
      id: stage,
      label: CONSIGNMENT_STAGE_LABEL[stage],
      count: progress[stage],
      empty: progress[stage] === 0,
      href: consignmentStageHref(stage),
    }),
  );
}
