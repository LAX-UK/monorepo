import { formatLondonDayMonth } from "@/lib/datetime/london-time";
import { type HangLabelModel, hangLabelModel } from "@/lib/hang/hang-label";
import { type HangLotPhoto, hangLotPhoto } from "@/lib/hang/hang-lot";
import { pickHangLots } from "@/lib/hang/hang-selection";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import { lotPath, salePath } from "@/lib/seo/url";
import type { HomeStateResult } from "@auction/domain";
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

/** The parts of the home state that decide what hangs. */
export type HomeHangState = Pick<HomeStateResult, "state" | "leadSaleId" | "resultsBandSaleIds">;

/** Ended sales mixed on the wall between seasons. */
const BAND_SALES = 2;

/**
 * Which sales' lots the hang needs for this home state: the lead sale when a sale is live,
 * upcoming, just ended or in recent results; the last two ended sales between seasons.
 */
export function hangSaleIds(state: HomeHangState): string[] {
  if (state.state === "betweenSeasons") return state.resultsBandSaleIds.slice(0, BAND_SALES);
  return state.leadSaleId ? [state.leadSaleId] : [];
}

/** "In this sale" for a sale that is live or opening; "Recently sold" once results are in. */
export function hangKind(state: HomeHangState["state"]): HomeHangVM["kind"] {
  return state === "live" || state === "upcoming" ? "inSale" : "recentlySold";
}

/** What can hang, in hanging order, before the page gives each lot to one place. */
export type HangPlan = {
  kind: HomeHangVM["kind"];
  /** The sales the candidates come from. */
  sales: readonly HangSale[];
  /** Several sales share the wall, so each label names its sale. */
  mixed: boolean;
  candidates: Lot[];
};

function soldLots(entry: HangSale): Lot[] {
  return entry.lots.filter((lot) => lot.status === "ended" && lotWasSold(lot));
}

/**
 * The candidates for the wall: the lead sale's featured lots first, then its top lots. Results
 * walls take sold lots only. `null` when there is nothing to hang.
 */
export function planHomeHang(state: HomeHangState, loaded: readonly HangSale[]): HangPlan | null {
  const kind = hangKind(state.state);
  const byId = new Map(loaded.map((entry) => [entry.sale.id, entry]));
  const wanted = hangSaleIds(state).flatMap((id) => byId.get(id) ?? []);

  if (kind === "inSale") {
    const entry = wanted[0];
    if (!entry) return null;
    const candidates = pickHangLots(entry.lots, entry.sale.featuredLotIds ?? []);
    return { kind, sales: [entry], mixed: false, candidates };
  }

  const withResults = wanted.filter((entry) => soldLots(entry).length > 0);
  const first = withResults[0];
  if (!first) return null;
  const mixed = withResults.length > 1;
  const candidates = pickHangLots(
    withResults.flatMap(soldLots),
    mixed ? [] : (first.sale.featuredLotIds ?? []),
  );
  return { kind, sales: withResults, mixed, candidates };
}

function lotsLabel(count: number): string {
  return `${count} lot${count === 1 ? "" : "s"}`;
}

/** How a work's label reads when it hangs among works from other sales. */
type LabelOverride = { eyebrow: string; notes: string[] };

function toWork(lot: Lot, sale: Sale, now: Date, override?: LabelOverride): HomeHangWork | null {
  const photo = hangLotPhoto(lot);
  if (!photo) return null;
  const label = hangLabelModel(lot, { sale, now, shownFramed: photo.shownFramed });
  return { lotId: lot.id, href: lotPath(lot), photo, label: { ...label, ...override } };
}

function saleOfLot(plan: HangPlan): Map<string, HangSale> {
  return new Map(plan.sales.flatMap((entry) => entry.lots.map((lot) => [lot.id, entry] as const)));
}

function inThisSaleCopy(entry: HangSale, shown: number) {
  const total = Math.max(entry.lotCount, shown);
  const totalLabel = lotsLabel(total);
  const live = entry.sale.status === "active";
  return {
    title: "In this sale",
    summary: shown === total ? totalLabel : `${shown} of ${totalLabel}`,
    scaleNote: true,
    seeAll: {
      href: salePath(entry.sale),
      label: live ? `See all ${totalLabel}` : `Preview all ${totalLabel}`,
      tileNote: entry.sale.title,
    },
  };
}

function recentlySoldCopy(plan: HangPlan) {
  const first = plan.sales[0];
  if (!first || plan.mixed) {
    return {
      title: "Recently sold",
      summary: "From the last two sales · prices include buyer’s premium",
      scaleNote: false,
      seeAll: { href: "/archive", label: "All results" },
    };
  }
  return {
    title: "Recently sold",
    summary: `${first.sale.title} · ${lotsLabel(soldLots(first).length)} sold · prices include buyer’s premium`,
    scaleNote: false,
    seeAll: { href: salePath(first.sale), label: "See the results" },
  };
}

/**
 * The hang section for the lots the page gave it. The title follows the home state: "In this
 * sale" while live or upcoming, "Recently sold" otherwise. `null` when fewer than two works
 * with photographs remain.
 */
export function buildHomeHang(
  plan: HangPlan | null,
  allocated: readonly Lot[],
  now: Date,
): HomeHangVM | null {
  const first = plan?.sales[0];
  if (!plan || !first) return null;
  const owner = saleOfLot(plan);
  const works = allocated
    .map((lot) => {
      const entry = owner.get(lot.id) ?? first;
      return toWork(
        lot,
        entry.sale,
        now,
        plan.mixed
          ? { eyebrow: entry.sale.title, notes: [formatLondonDayMonth(entry.sale.endTime, now)] }
          : undefined,
      );
    })
    .filter((w): w is HomeHangWork => w !== null);
  if (works.length < 2) return null;

  const copy =
    plan.kind === "inSale" ? inThisSaleCopy(first, works.length) : recentlySoldCopy(plan);
  return { kind: plan.kind, ...copy, works };
}
