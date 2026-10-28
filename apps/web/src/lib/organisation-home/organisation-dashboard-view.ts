import { formatEstimateRange } from "@/lib/money/currency";
import { CLIENT_ROUTES, organisationHref } from "@/lib/navigation/client-routes";
import { formatDate, formatMoney } from "@/lib/ui/format";
import {
  CONSIGNMENT_PROGRESS_STAGES,
  type DashboardTile,
  type FirstRunAction,
  type MoneyTotal,
  type OrganisationDashboardModel,
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
  supporting: string | null;
  /** Read to assistive technology with the tile: what exactly the figure counts. */
  description: string;
  href: string;
};

export type UpcomingSaleView = {
  id: string;
  title: string;
  date: string;
  dateTime: string;
  works: string;
  href: string;
};

export type ConsignmentStageView = {
  id: string;
  label: string;
  count: number;
  /** `null` for a stage with nothing in it: there is nothing to open. */
  href: string | null;
};

export type FirstRunView = {
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
      tile.busiest
        .map(({ stage, count }) => `${count} ${CONSIGNMENT_STAGE_LABEL[stage].toLowerCase()}`)
        .join(" · ") || null,
    emptyText: "No works in progress",
    description: `${tile.own ? "Works you sent" : "Works"}, from first review to sale. Drafts and closed works are not counted.`,
    href: CLIENT_ROUTES.consignments,
  }),
  in_upcoming_sales: (tile) => ({
    label: "In upcoming sales",
    figures: [plural(tile.works, "work")],
    supporting:
      tile.estimates.length > 0
        ? `Estimate ${tile.estimates.map((estimate) => formatEstimateRange(estimate)).join(" · ")}`
        : "Estimates to follow",
    emptyText: "No works in a sale yet",
    description: `${tile.own ? "Works you sent" : "Works"} in sales that have not ended, with their combined estimates.`,
    href: consignmentStageHref("in_sale"),
  }),
  sold_this_year: (tile) => ({
    label: "Sold this year",
    figures: money(tile.totals),
    supporting: `${plural(tile.works, "work")} since 1 January`,
    emptyText: "Nothing sold yet this year",
    description: `Hammer prices of works sold from 1 January to 31 December ${tile.year}, UK time.`,
    href: consignmentStageHref("sold"),
  }),
  payouts_due: (tile) => ({
    label: "Payouts due",
    figures: money(tile.totals),
    supporting: tile.nextDate ? `Next on ${formatDate(tile.nextDate)}` : null,
    emptyText: "No payouts due",
    description: "Payouts scheduled or on their way to the bank account, after fees.",
    href: CLIENT_ROUTES.payouts,
  }),
  open_bids: (tile, ctx) => ({
    label: "Open bids",
    figures: [plural(tile.lots, "lot")],
    supporting:
      tile.totalMax.length > 0 ? `Up to ${money(tile.totalMax).join(" · ")} in all` : null,
    emptyText: "No open bids",
    description: tile.own
      ? `Lots still open where you've bid for ${ctx.organisationName}, and the most you've committed on each: your highest bid, automatic bid or absentee maximum.`
      : `Lots still open with bids for ${ctx.organisationName}, and the most it could pay on each: the highest bid, automatic bid or absentee maximum.`,
    href: CLIENT_ROUTES.bids,
  }),
  purchases_to_pay: (tile) => ({
    label: "Purchases to pay",
    figures: money(tile.totals),
    supporting: plural(tile.purchases, "purchase"),
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
      supporting,
      emptyText: "Not authorised yet",
      description: "The most you may bid for the organisation, set by its owners.",
      href: CLIENT_ROUTES.bids,
    };
  },
  authorised_sales: (tile) => ({
    label: "Sales you can bid in",
    figures: [tile.everySale ? "Every sale" : plural(tile.sales, "sale")],
    supporting:
      tile.toRegister > 0
        ? `${plural(tile.toRegister, "sale")} to register for`
        : tile.sales > 0
          ? "Registered for all"
          : "Register for each sale you join",
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
    supporting: tile.empty ? null : view.supporting,
  };
}

function upcomingSaleView(sale: UpcomingSaleFigure): UpcomingSaleView {
  return {
    id: sale.id,
    title: sale.title,
    date: formatDate(sale.startsAt),
    dateTime: sale.startsAt.toISOString(),
    works: plural(sale.works, "work"),
    href: salePath({ id: sale.id, title: sale.title }),
  };
}

/** First steps, by the first thing the role can do. */
const FIRST_RUN_COPY: Record<FirstRunAction | "none", (ctx: Ctx) => Omit<FirstRunView, "actions">> =
  {
    sell: (ctx) => ({
      title: `Get ${ctx.organisationName} started`,
      description:
        "Send a first work to our specialists. Sales, payouts and bids show here as they happen.",
    }),
    invite: (ctx) => ({
      title: `Get ${ctx.organisationName} started`,
      description: "Invite your team. Sales, payouts and bids show here as they happen.",
    }),
    none: (ctx) => ({
      title: "Nothing here yet",
      description: `Sales, payouts and bids show here once ${ctx.organisationName} starts selling or buying.`,
    }),
  };

const FIRST_RUN_ACTION: Record<FirstRunAction, { label: string; href: string }> = {
  sell: { label: "Sell a work", href: CLIENT_ROUTES.sellingNew },
  invite: { label: "Invite someone", href: organisationHref("members") },
};

function firstRunView(actions: readonly FirstRunAction[], ctx: Ctx): FirstRunView {
  return {
    ...FIRST_RUN_COPY[actions[0] ?? "none"](ctx),
    actions: actions.map((id) => ({ id, ...FIRST_RUN_ACTION[id] })),
  };
}

/** The dashboard's words and links, from the domain model. */
export function organisationDashboardView(
  model: OrganisationDashboardModel,
  ctx: Ctx,
): OrganisationDashboardView {
  const { progress } = model;
  return {
    firstRun: model.firstRun ? firstRunView(model.firstRun.actions, ctx) : null,
    tiles: model.tiles.map((tile) => dashboardTileView(tile, ctx)),
    upcomingSales: model.upcomingSales.map(upcomingSaleView),
    upcomingSalesHref: consignmentStageHref("in_sale"),
    stages: progress
      ? CONSIGNMENT_PROGRESS_STAGES.map((stage) => ({
          id: stage,
          label: CONSIGNMENT_STAGE_LABEL[stage],
          count: progress[stage],
          href: progress[stage] > 0 ? consignmentStageHref(stage) : null,
        }))
      : null,
  };
}
