import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { adminLotListPath } from "@/lib/admin/catalog-routes";
import type { AdminLotTableRow } from "@/lib/admin/catalog/lot-table-row";
import { lotLensHref } from "@/lib/admin/catalog/lots-lenses";
import type { CatalogActiveFilterChip, CatalogSegmentItem } from "@/lib/admin/catalog/types";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminLotsListSummary } from "@/lib/data/http/admin-lots-summary.server";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  type TeamView,
  formatStaffMoney,
  metricChange,
  viewQuery,
} from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";

export type LotsListSearch = Record<string, string | string[] | undefined>;

/** One lot as the staff list shows it; plain data, so it crosses to the client as is. */
export type LotsStaffRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  thumbnailUrl: string | null;
  artist: string | null;
  saleTitle: string | null;
  saleHref: string | null;
  /** "Lot 12 · Ada Lovelace"; null when the lot has neither yet. */
  context: string | null;
  statusCode: LotStatus;
  status: StatusPresentation;
  auctionType: string;
  /** "£2,000–£3,000"; null when no estimate is set. */
  estimate: string | null;
  /** The hammer price; null until the lot has bids. */
  hammer: string | null;
  /** "From £500.00" for a lot that has not opened yet. */
  startingFrom: string | null;
  endsAt: string;
  addedAt: string;
  href: string;
  editHref: string;
  photos: number;
  inDraftSale: boolean;
  canDelete: boolean;
  hasWinner: boolean;
  /** When the seller asked to withdraw the lot, if a request is waiting. */
  withdrawalRequestedAt: string | null;
};

/** The table formatters write a dash for "nothing"; the kit draws its own empty value. */
function present(value: string | undefined): string | null {
  const text = value?.trim();
  return text && text !== "—" ? text : null;
}

export function toLotsStaffRows(
  rows: readonly AdminLotTableRow[],
  withdrawalRequestedAt: Readonly<Record<string, string>> = {},
): LotsStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lotNumber: row.lotNumber,
    thumbnailUrl: row.thumbnailUrl,
    artist: row.artistLabel,
    saleTitle: row.saleTitle,
    saleHref: row.saleId ? `/admin/sales/${row.saleId}` : null,
    context:
      [row.lotNumber != null ? `Lot ${row.lotNumber}` : null, row.artistLabel]
        .filter(Boolean)
        .join(" · ") || null,
    statusCode: row.status,
    status: staffStatus("lot", row.status, { lot: { hasWinner: row.hasWinner } }),
    auctionType: lotAuctionTypeLabel(row.auctionType),
    estimate: present(row.estimateDisplay.primary),
    hammer: present(row.hammerDisplay.primary),
    startingFrom: present(row.hammerDisplay.secondary),
    endsAt: row.endTimeIso,
    addedAt: row.createdAtIso,
    href: adminLotHref(row.id),
    editHref: adminLotEditHref(row.id),
    photos: row.imageCount,
    inDraftSale: row.saleStatus === "draft",
    canDelete: row.canDelete,
    hasWinner: row.hasWinner,
    withdrawalRequestedAt: withdrawalRequestedAt[row.id] ?? null,
  }));
}

/** Status filter, as the lots API understands it. */
export const LOT_STATUS_FILTERS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "cancelled", label: "Withdrawn" },
] as const;

/** The list URL with `patch` applied; any filter change returns to the first page. */
export function lotsListHref(
  current: LotsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: LotsListSearch = { ...current };
  for (const key of ["error", "success", "period", "lot"]) delete base[key];
  return buildListHref(adminLotListPath(), base, { offset: null, ...patch });
}

/** The list with a lot's panel open (`?lot=`), or closed for null; keeps the page. */
export function lotPanelHref(current: LotsListSearch, lotId: string | null): string {
  const base: LotsListSearch = { ...current };
  for (const key of ["error", "success", "period"]) delete base[key];
  return buildListHref(adminLotListPath(), base, { lot: lotId });
}

/** The lenses as view tabs, each with its count. */
export function lotsViews(lenses: readonly CatalogSegmentItem[]): StaffDataView[] {
  return lenses.map((lens) => ({
    id: lens.id,
    label: lens.label,
    href: lens.href,
    ...(lens.badge !== undefined ? { count: lens.badge } : {}),
  }));
}

/**
 * Views of the lots list everyone sees, beyond the lens tabs: combinations of the list's own
 * filters. Fixed here, never edited.
 */
export function lotsTeamViews(): TeamView[] {
  const view = (id: string, label: string, patch: Record<string, string>) => {
    const [path, rest = ""] = lotsListHref({}, patch).split("?");
    const query = viewQuery(rest);
    return { id: `team-${id}`, label, href: `${path}?${query}`, query };
  };
  return [
    view("drafts-missing-photos", "Drafts missing photos", { status: "draft", needsPhotos: "1" }),
    view("live-ending-first", "Live, ending soonest", { status: "active", sort: "endingAsc" }),
    view("ended-by-hammer", "Ended, highest hammer first", {
      status: "ended",
      sort: "hammerDesc",
    }),
  ];
}

/** Work waiting on the catalogue desk, each linking to the view that holds it. */
export function lotsAttention(
  search: LotsListSearch,
  counts: { withdrawalsPending: number; draftsMissingPhotos: number },
): AttentionStripItem[] {
  const noun = (count: number, one: string, many: string) => (count === 1 ? one : many);
  return [
    {
      id: "withdrawals",
      count: counts.withdrawalsPending,
      label: noun(
        counts.withdrawalsPending,
        "seller has asked to withdraw a lot",
        "sellers have asked to withdraw lots",
      ),
      href: lotsListHref(search, { lens: "withdrawals", status: null, needsPhotos: null }),
      actionLabel: "Decide",
      tone: "warning",
    },
    {
      id: "photos",
      count: counts.draftsMissingPhotos,
      label: noun(
        counts.draftsMissingPhotos,
        "draft lot has no photos",
        "draft lots have no photos",
      ),
      href: lotsListHref(search, { lens: "attention", status: "draft", needsPhotos: "1" }),
      actionLabel: "Add photos",
      tone: "neutral",
    },
  ];
}

/** The daily series behind the lots summary, each null when it could not be loaded. */
export type LotsMetricTrends = {
  /** Lots open for bidding each day. */
  live?: AdminKpiTrendBundle | null;
  /** Lots that ended each day. */
  ended?: AdminKpiTrendBundle | null;
  /** Lots added each day. */
  added?: AdminKpiTrendBundle | null;
  /** Hammer of lots ended each day. */
  hammer?: AdminKpiTrendBundle | null;
};

const trendDays = (trends: LotsMetricTrends) =>
  Math.max(
    0,
    ...[trends.live, trends.ended, trends.added, trends.hammer].map(
      (trend) => trend?.dailyCounts.length ?? 0,
    ),
  );

/** The period line over the lots summary: counts are now, the trends cover the period. */
export function lotsMetricsPeriod(trends: LotsMetricTrends): string {
  const days = trendDays(trends);
  return days > 1 ? `All lots · daily trends over the last ${days} days` : "All lots";
}

/** A count's daily series, what it counts, and its change against the period before. */
function lotTrend(
  trend: AdminKpiTrendBundle | null | undefined,
  what: string,
  rise: "good" | "bad" | "neutral",
): Pick<Metric, "trend" | "trendLabel" | "comparison"> {
  const days = trend?.dailyCounts.length ?? 0;
  if (!trend || days < 2) return {};
  const change = metricChange({
    current: trend.currentTotal,
    prior: trend.priorTotal,
    basis: `${what.toLowerCase()}, vs previous ${days} days`,
    rise,
  });
  return {
    trend: trend.dailyCounts,
    trendLabel: `${what}, last ${days} days`,
    ...(change ? { comparison: change } : {}),
  };
}

/**
 * Headline numbers across every lot, from the lots summary. The counts link to their view. Each
 * carries the daily series closest to it, named on hover and in the change: lots open each day
 * beside Live, lots ended each day beside Ending, lots added each day beside Drafts, and hammer of
 * lots ended each day beside the hammer total.
 */
export function lotsMetrics(
  summary: AdminLotsListSummary,
  trends: LotsMetricTrends = {},
): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  const hammer = Number.parseFloat(summary.totalHammerValue);
  return [
    {
      id: "live",
      label: "Live",
      value: count.format(summary.liveCount),
      tone: summary.liveCount > 0 ? "positive" : "neutral",
      href: lotLensHref("live", {}),
      ...lotTrend(trends.live, "Lots open for bidding each day", "good"),
    },
    {
      id: "ending",
      label: "Ending in 24 hours",
      value: count.format(summary.endingSoonCount),
      tone: summary.endingSoonCount > 0 ? "attention" : "neutral",
      href: lotLensHref("ending", {}),
      ...lotTrend(trends.ended, "Lots ended each day", "neutral"),
    },
    {
      id: "draft",
      label: "Drafts",
      value: count.format(summary.draftCount),
      href: lotLensHref("draft", {}),
      ...lotTrend(trends.added, "Lots added each day", "good"),
    },
    {
      id: "hammer",
      label: "Hammer total",
      value: formatStaffMoney(Math.round((Number.isFinite(hammer) ? hammer : 0) * 100)),
      ...lotTrend(trends.hammer, "Hammer of lots ended each day", "good"),
    },
  ];
}

/**
 * The filters in force beyond the view tab, as chips. The search shows in its own field and the
 * sort in the column headers, so neither is repeated as a chip.
 */
export function lotsFilterChips(chips: readonly CatalogActiveFilterChip[]) {
  return chips
    .filter((chip) => chip.id !== "q" && chip.id !== "sort")
    .map((chip) => ({ id: chip.id, label: chip.label, clearHref: chip.clearHref }));
}

/** "1–50 of 312 lots", or "1–50 lots" while the total is not known. */
export function lotsRangeSummary(offset: number, shown: number, total: number | undefined) {
  const count = new Intl.NumberFormat("en-GB");
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  if (total === undefined) return `${range} lots`;
  return `${range} of ${count.format(total)} ${total === 1 ? "lot" : "lots"}`;
}

/** The server's default order: newest lots first. */
export const LOTS_DEFAULT_SORT = { columnId: "added", direction: "desc" as const };

/**
 * Column sort to the server's sort keys. The lots API sorts by when a lot was added (newest
 * first, the default), by ending time (soonest first, or most recently ended) and by hammer.
 */
export function lotsSortHref(
  current: LotsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" },
): string {
  if (sort.columnId === "ends") {
    return lotsListHref(current, { sort: sort.direction === "asc" ? "endingAsc" : "endedDesc" });
  }
  if (sort.columnId === "hammer") return lotsListHref(current, { sort: "hammerDesc" });
  return lotsListHref(current, { sort: null });
}

export function lotsSortState(sort: string | undefined) {
  switch (sort) {
    case "endingAsc":
      return { columnId: "ends", direction: "asc" as const };
    case "endedDesc":
      return { columnId: "ends", direction: "desc" as const };
    case "hammerDesc":
      return { columnId: "hammer", direction: "desc" as const };
    default:
      return LOTS_DEFAULT_SORT;
  }
}
