import { formatLondonDayMonth } from "@/lib/datetime/london-time";
import { type HangLabelModel, hangLabelModel } from "@/lib/hang/hang-label";
import { type HangLotPhoto, hangLotPhoto } from "@/lib/hang/hang-lot";
import { pickHangLots } from "@/lib/hang/hang-selection";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";

/** A sale with the lots fetched for it. */
export type HangSale = { sale: Sale; lots: Lot[]; lotCount: number };

export type HomeHangWork = {
  lotId: string;
  href: string;
  photo: HangLotPhoto;
  label: HangLabelModel;
};

export type HomeHangVM = {
  /** "In this sale" while a sale is live or upcoming; "Recently sold" otherwise. */
  kind: "inSale" | "recentlySold";
  title: string;
  /** Text before the scale note: "8 lots", or "September Modern British · 4 lots sold". */
  summary: string;
  /** Whether to add "hung at true relative scale" (only when the wall is to scale). */
  scaleNote: boolean;
  seeAll: { href: string; label: string; tileNote?: string };
  works: HomeHangWork[];
};

export type HomeHangInput = {
  /** Scheduled and active sales, soonest first; only the current one needs its lots. */
  openSales: readonly HangSale[];
  /** Ended sales, most recent first, with their lots. */
  endedSales: readonly HangSale[];
  now: Date;
};

/** The hang needs at least two works with photographs; one is already the hero's work. */
const MIN_WORKS = 2;
const RECENT_SALES = 2;

function lotsLabel(count: number): string {
  return `${count} lot${count === 1 ? "" : "s"}`;
}

/** How a work's label reads when it hangs among works from other sales. */
type LabelOverride = { eyebrow: string; notes: string[] };

function toWork(
  lot: Lot,
  sale: HangSale["sale"],
  now: Date,
  override?: LabelOverride,
): HomeHangWork | null {
  const photo = hangLotPhoto(lot);
  if (!photo) return null;
  const label = hangLabelModel(lot, { sale, now, shownFramed: photo.shownFramed });
  return { lotId: lot.id, href: lotPath(lot), photo, label: { ...label, ...override } };
}

/** The sale the hang follows: the live one, else the next to open. */
export function pickCurrentSale<T extends { sale: Pick<Sale, "status"> }>(
  open: readonly T[],
): T | null {
  return open.find((entry) => entry.sale.status === "active") ?? open[0] ?? null;
}

function inThisSale(entry: HangSale, now: Date): HomeHangVM | null {
  const lots = pickHangLots(entry.lots, entry.sale.featuredLotIds ?? []);
  const works = lots.map((lot) => toWork(lot, entry.sale, now)).filter((w) => w !== null);
  if (works.length < MIN_WORKS) return null;
  const total = Math.max(entry.lotCount, works.length);
  const totalLabel = lotsLabel(total);
  return {
    kind: "inSale",
    title: "In this sale",
    summary: works.length === total ? totalLabel : `${works.length} of ${totalLabel}`,
    scaleNote: true,
    seeAll: {
      href: salePath(entry.sale),
      label: entry.sale.status === "active" ? `See all ${totalLabel}` : `Preview all ${totalLabel}`,
      tileNote: entry.sale.title,
    },
    works,
  };
}

function soldLots(entry: HangSale): Lot[] {
  return entry.lots.filter((lot) => lot.status === "ended" && lotWasSold(lot));
}

function recentlySold(ended: readonly HangSale[], now: Date): HomeHangVM | null {
  const sales = ended.filter((entry) => soldLots(entry).length > 0).slice(0, RECENT_SALES);
  const first = sales[0];
  if (!first) return null;
  const single = sales.length === 1;

  const pooled = sales.flatMap((entry) => soldLots(entry).map((lot) => ({ lot, entry })));
  const bySale = new Map(pooled.map(({ lot, entry }) => [lot.id, entry]));
  const picked = pickHangLots(
    pooled.map(({ lot }) => lot),
    single ? (first.sale.featuredLotIds ?? []) : [],
  );
  const works = picked
    .map((lot) => {
      const entry = bySale.get(lot.id) ?? first;
      return toWork(
        lot,
        entry.sale,
        now,
        single
          ? undefined
          : {
              eyebrow: entry.sale.title,
              notes: [formatLondonDayMonth(entry.sale.endTime, now)],
            },
      );
    })
    .filter((w) => w !== null);
  if (works.length < MIN_WORKS) return null;

  const results = single
    ? { href: salePath(first.sale), label: "See the results" }
    : { href: "/archive", label: "All results" };
  const sold = soldLots(first).length;
  return {
    kind: "recentlySold",
    title: "Recently sold",
    summary: single
      ? `${first.sale.title} · ${lotsLabel(sold)} sold · prices include buyer’s premium`
      : "From the last two sales · prices include buyer’s premium",
    scaleNote: false,
    seeAll: results,
    works,
  };
}

/**
 * The hang under the home hero. A live or upcoming sale shows "In this sale" and follows its
 * lots as bidding moves. With none, "Recently sold" shows what the last sales made, buyer's
 * premium included. Either needs two works with photographs; with fewer the section is left out.
 */
export function resolveHomeHang(input: HomeHangInput): HomeHangVM | null {
  const open = pickCurrentSale(input.openSales);
  if (open) return inThisSale(open, input.now);
  return recentlySold(input.endedSales, input.now);
}

/** The lots the hang shows, so "More lots" does not repeat them. */
export function homeHangLotIds(hang: HomeHangVM | null): Set<string> {
  return new Set((hang?.works ?? []).map((w) => w.lotId));
}
