import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { resolveLotDotStatusPresentation } from "@/lib/presenters/status/resolver";
import { lotPath, salePath } from "@/lib/seo/url";
import { deriveReserveStatus } from "@auction/domain";
import type { Lot, LotStatus } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";
import { toDisplayDate, toRequiredIsoString } from "@auction/validators";

export type SellerLotStatusFilter = "live" | "scheduled" | "ended" | "all";

type SaleSummary = { id: string; title: string };

export type InSaleDisplayRow = {
  id: string;
  lotNumberLabel: string;
  title: string;
  /** Public catalogue link for the lot (slug + id). */
  lotHref: string;
  /** Public sale link, when the lot is associated with a sale. */
  saleHref: string | null;
  saleTitle: string | null;
  status: LotStatus;
  statusLabel: string;
  statusDotTone: DotStatusPillTone;
  /** Whether the current price meets or exceeds the reserve price. */
  reserveMet: boolean;
  /** Human-readable label: "Met", "Below reserve", or "No reserve". */
  reserveLabel: string;
  /** When ended: sold vs passed (no winner). */
  saleOutcome: "sold" | "passed" | null;
  currentPriceLabel: string;
  endTimeIso: string;
  endTimeLabel: string;
  startTimeIso: string;
  imageUrl: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

function lotStatusView(lot: Pick<Lot, "status" | "winnerId">): {
  label: string;
  statusDotTone: DotStatusPillTone;
} {
  const context = lot.status === "ended" ? { winnerId: lot.winnerId } : undefined;
  const presentation = resolveLotDotStatusPresentation(lot.status, context);
  return { label: presentation.label, statusDotTone: presentation.tone };
}

/** Reserve-met indicator. Returns null-safe results for lots without a reserve. */
function deriveReserve(lot: Lot): {
  met: boolean;
  label: string;
  saleOutcome: "sold" | "passed" | null;
} {
  if (lot.status === "ended") {
    if (lot.winnerId) {
      const status = deriveReserveStatus(lot.currentPrice, lot.reservePrice);
      if (status.kind === "none") {
        return { met: true, label: "Sold", saleOutcome: "sold" };
      }
      return {
        met: status.kind === "met",
        label: status.kind === "met" ? "Sold · reserve met" : "Sold",
        saleOutcome: "sold",
      };
    }
    const status = deriveReserveStatus(lot.currentPrice, lot.reservePrice);
    if (status.kind === "none") {
      // No reserve — distinguish "no bids at all" from "clerk passed with bids"
      // Use currentPrice vs startingPrice as a proxy (price only rises on a bid).
      const hadBids =
        lot.currentPrice !== lot.startingPrice &&
        Number.parseFloat(lot.currentPrice) > Number.parseFloat(lot.startingPrice);
      return {
        met: true,
        label: hadBids ? "No sale" : "No sale · no bids",
        saleOutcome: "passed",
      };
    }
    return {
      met: status.kind === "met",
      label: status.kind === "met" ? "No sale" : "No sale · below reserve",
      saleOutcome: "passed",
    };
  }

  const status = deriveReserveStatus(lot.currentPrice, lot.reservePrice);
  if (status.kind === "none") {
    return { met: true, label: "No reserve", saleOutcome: null };
  }
  return status.kind === "met"
    ? { met: true, label: "Met", saleOutcome: null }
    : { met: false, label: "Below reserve", saleOutcome: null };
}

/** Map domain lot rows to display rows. Pure: deterministic, no IO. */
export function toInSaleDisplayRows(
  lots: Lot[],
  saleById: Map<string, SaleSummary>,
): InSaleDisplayRow[] {
  return lots.map((lot) => {
    const view = lotStatusView(lot);
    const sale = lot.saleId ? saleById.get(lot.saleId) : undefined;
    const reserve = deriveReserve(lot);
    return {
      id: lot.id,
      lotNumberLabel: lot.lotNumber == null ? "—" : `#${lot.lotNumber}`,
      title: lot.title,
      lotHref: lotPath({ id: lot.id, title: lot.title }),
      saleHref: sale ? salePath({ id: sale.id, title: sale.title }) : null,
      saleTitle: sale?.title ?? null,
      status: lot.status,
      statusLabel: view.label,
      statusDotTone: view.statusDotTone,
      reserveMet: reserve.met,
      reserveLabel: reserve.label,
      saleOutcome: reserve.saleOutcome,
      currentPriceLabel: formatMoney(lot.currentPrice, resolveLotCurrency(lot)),
      endTimeIso: toRequiredIsoString(lot.endTime),
      endTimeLabel: formatDateTime(toDisplayDate(lot.endTime)),
      startTimeIso: toRequiredIsoString(lot.startTime),
      imageUrl: lot.images[0] ?? null,
    };
  });
}

/** Apply a status-band filter. "live" includes scheduled + active so sellers
 * see imminent + currently-running work in one tab; "ended" includes ended +
 * voided + cancelled (post-sale terminal states). */
export function filterInSaleRows(
  rows: InSaleDisplayRow[],
  filter: SellerLotStatusFilter,
): InSaleDisplayRow[] {
  if (filter === "all") return rows;
  if (filter === "live") {
    return rows.filter((r) => r.status === "scheduled" || r.status === "active");
  }
  if (filter === "scheduled") {
    return rows.filter((r) => r.status === "scheduled");
  }
  return rows.filter(
    (r) => r.status === "ended" || r.status === "voided" || r.status === "cancelled",
  );
}

/** Live + scheduled first by ascending end time; then ended states descending. */
export function sortInSaleRows(rows: InSaleDisplayRow[]): InSaleDisplayRow[] {
  const order: Record<LotStatus, number> = {
    active: 0,
    scheduled: 1,
    ended: 2,
    cancelled: 3,
    voided: 4,
    draft: 5,
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const oa = order[a.row.status];
      const ob = order[b.row.status];
      if (oa !== ob) return oa - ob;
      const ta = Date.parse(a.row.endTimeIso);
      const tb = Date.parse(b.row.endTimeIso);
      const naA = Number.isNaN(ta);
      const naB = Number.isNaN(tb);
      if (naA && naB) return a.index - b.index;
      if (naA) return 1;
      if (naB) return -1;
      // upcoming/active: sort ascending; ended/cancelled/voided: descending
      const ascending =
        a.row.status === "active" || a.row.status === "scheduled" || a.row.status === "draft";
      const cmp = ascending ? ta - tb : tb - ta;
      if (cmp !== 0) return cmp;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

export function parseSellerLotStatusFilter(raw: string | undefined | null): SellerLotStatusFilter {
  if (raw === "scheduled" || raw === "ended" || raw === "all") return raw;
  return "live";
}

export const SELLER_LOT_FILTER_OPTIONS: Array<{ value: SellerLotStatusFilter; label: string }> = [
  { value: "live", label: "Live & scheduled" },
  { value: "scheduled", label: "Scheduled only" },
  { value: "ended", label: "Closed" },
  { value: "all", label: "All" },
];

export function inSaleFilterHref(pathname: string, filter: SellerLotStatusFilter): string {
  const params = new URLSearchParams();
  if (filter !== "live") params.set("status", filter);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
