import { formatLotMoment } from "@/lib/bid/lot-moment";
import type { SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney, formatWholeMoney } from "@/lib/format-currency";
import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import type { PayoutStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

type Badge = { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };

/**
 * Where a sold lot's money stands, as the seller reads it: waiting on the buyer is neutral, paid
 * and on its way is information, in the bank is good news, and a payout that did not go through
 * asks for attention (the team is already on it).
 */
export const SOLD_STAGE_BADGE: Record<SoldLot["stage"], Badge> = {
  buyer_paying: { label: "Buyer paying", tone: "neutral", shape: "ring" },
  paid_by_buyer: { label: "Paid by buyer", tone: "info", shape: "dot" },
  in_payout: { label: "In payout", tone: "info", shape: "dot" },
  paid_out: { label: "Paid out", tone: "success", shape: "check" },
  payout_problem: { label: "Payout delayed", tone: "warning", shape: "alert" },
  refunded: { label: "Refunded", tone: "neutral", shape: "ring" },
};

/** A payout's state, in the seller's words. */
export const PAYOUT_STATUS_BADGE: Record<PayoutStatus, Badge> = {
  scheduled: { label: "Scheduled", tone: "neutral", shape: "ring" },
  in_transit: { label: "On its way", tone: "info", shape: "dot" },
  paid: { label: "Paid", tone: "success", shape: "check" },
  failed: { label: "Delayed", tone: "warning", shape: "alert" },
  reversed: { label: "Delayed", tone: "warning", shape: "alert" },
  clawback_pending: { label: "Under review", tone: "warning", shape: "alert" },
};

export type SoldRecord = {
  lotId: string;
  title: string;
  /** "Autumn Modern British · lot 31 · sold 22 Oct" as facts. */
  meta: string[];
  hammer: string;
  /** What the seller receives, once the buyer has paid; `null` before. */
  net: string | null;
  badge: Badge;
  /** The payout it is on, when it is on one. */
  payoutHref: string | null;
  soldAt: number;
  year: number;
  hammerAmount: number;
};

export function payoutHref(payoutId: string): string {
  return `/selling/payouts/${encodeURIComponent(payoutId)}`;
}

/** A sold lot as the list shows it; the date on the badge says when its payout moved. */
export function soldRecord(lot: SoldLot, now: Date): SoldRecord {
  const base = SOLD_STAGE_BADGE[lot.stage];
  const settled = lot.payout?.settledAt;
  const badge =
    settled && lot.stage === "paid_out"
      ? { ...base, label: `${base.label} ${formatLotMoment(settled, now, { time: false })}` }
      : base;
  return {
    lotId: lot.lotId,
    title: lot.lotTitle,
    meta: [
      lot.saleTitle,
      lot.lotNumber == null ? null : `lot ${lot.lotNumber}`,
      `sold ${formatLotMoment(lot.soldAt, now, { time: false })}`,
    ].filter((fact): fact is string => Boolean(fact)),
    hammer: formatWholeMoney(lot.hammerPrice, "GBP"),
    net: lot.net == null ? null : formatMoney(lot.net, "GBP"),
    badge,
    payoutHref: lot.payout ? payoutHref(lot.payout.id) : null,
    soldAt: lot.soldAt.getTime(),
    year: lot.soldAt.getUTCFullYear(),
    hammerAmount: Number.parseFloat(lot.hammerPrice) || 0,
  };
}

export const SOLD_VIEWS = ["sold", "payouts"] as const;
export type SoldView = (typeof SOLD_VIEWS)[number];
export const SOLD_VIEW_LABEL: Record<SoldView, string> = { sold: "Sold", payouts: "Payouts" };

export const SOLD_SORTS = ["newest", "oldest", "highest"] as const;
export type SoldSort = (typeof SOLD_SORTS)[number];
export const SOLD_SORT_LABEL: Record<SoldSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  highest: "Highest hammer",
};

export type SoldListQuery = { view: SoldView; q: string; year: number | null; sort: SoldSort };

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function parseSoldListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
): SoldListQuery {
  const year = Number.parseInt(searchParam(params.year) ?? "", 10);
  return {
    view: oneOf(SOLD_VIEWS, searchParam(params.tab)) ?? "sold",
    q: searchParam(params.q) ?? "",
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    sort: oneOf(SOLD_SORTS, searchParam(params.sort)) ?? "newest",
  };
}

export function soldListSearch(query: SoldListQuery): string {
  const params = new URLSearchParams({ tab: query.view });
  if (query.q) params.set("q", query.q);
  if (query.year) params.set("year", String(query.year));
  if (query.sort !== "newest") params.set("sort", query.sort);
  return `?${params.toString()}`;
}

const SORTERS: Record<SoldSort, (a: SoldRecord, b: SoldRecord) => number> = {
  newest: (a, b) => b.soldAt - a.soldAt,
  oldest: (a, b) => a.soldAt - b.soldAt,
  highest: (a, b) => b.hammerAmount - a.hammerAmount,
};

export function soldInView(records: readonly SoldRecord[], query: SoldListQuery): SoldRecord[] {
  return records
    .filter(
      (record) =>
        (!query.year || record.year === query.year) &&
        matchesEveryWord([record.title, ...record.meta], query.q),
    )
    .sort(SORTERS[query.sort]);
}

/** The years anything sold in, newest first, for the year filter. */
export function soldYears(records: readonly SoldRecord[]): number[] {
  return [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
}

export function isSoldListNarrowed(query: SoldListQuery): boolean {
  return Boolean(query.q || query.year);
}
