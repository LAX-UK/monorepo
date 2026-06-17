import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, LotStatus } from "@auction/types";
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
  statusTone: "success" | "danger" | "info" | "neutral";
  /** Whether the current price meets or exceeds the reserve price. */
  reserveMet: boolean;
  /** Human-readable label: "Met", "Below reserve", or "No reserve". */
  reserveLabel: string;
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

function lotStatusView(status: LotStatus): {
  label: string;
  tone: InSaleDisplayRow["statusTone"];
} {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "neutral" };
    case "scheduled":
      return { label: "Scheduled", tone: "info" };
    case "active":
      return { label: "Live", tone: "success" };
    case "ended":
      return { label: "Ended", tone: "neutral" };
    case "cancelled":
      return { label: "Cancelled", tone: "danger" };
    case "voided":
      return { label: "Voided", tone: "danger" };
  }
}

/** Reserve-met indicator. Returns null-safe results for lots without a reserve. */
function deriveReserve(lot: Lot): { met: boolean; label: string } {
  const reserve =
    lot.reservePrice == null || lot.reservePrice === ""
      ? null
      : Number.parseFloat(lot.reservePrice);
  const current = Number.parseFloat(lot.currentPrice);
  if (reserve == null || !Number.isFinite(reserve) || reserve <= 0) {
    return { met: true, label: "No reserve" };
  }
  if (!Number.isFinite(current)) {
    return { met: false, label: "Below reserve" };
  }
  return current >= reserve ? { met: true, label: "Met" } : { met: false, label: "Below reserve" };
}

/** Map domain lot rows to display rows. Pure: deterministic, no IO. */
export function toInSaleDisplayRows(
  lots: Lot[],
  saleById: Map<string, SaleSummary>,
): InSaleDisplayRow[] {
  return lots.map((lot) => {
    const view = lotStatusView(lot.status);
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
      statusTone: view.tone,
      reserveMet: reserve.met,
      reserveLabel: reserve.label,
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
