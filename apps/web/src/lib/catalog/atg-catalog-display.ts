import type { LifecycleBadgeVM } from "@/lib/lot/lot-lifecycle";
import type { Lot, Sale } from "@auction/types";
import { isAtgOwnedCatalogSale } from "@auction/validators";

type AtgSaleFields = Pick<
  Sale,
  "status" | "sellingPlatform" | "atgAuctionState" | "atgDistribution"
>;

/** Live/ended state of an ATG-owned sale, or null for LAX and free sales. */
export function atgCatalogState(sale: AtgSaleFields | null | undefined): "live" | "ended" | null {
  if (!sale || !isAtgOwnedCatalogSale(sale)) return null;
  return sale.atgAuctionState === "ended" ? "ended" : "live";
}

function liveStatus(startTime: Date | string, now: Date): "scheduled" | "active" {
  return new Date(startTime).getTime() > now.getTime() ? "scheduled" : "active";
}

/**
 * Display copy of an ATG-owned sale: the LAX row stays `draft`, but badges, timers and
 * filters should read it as upcoming, live or ended. Never use the result for bidding or
 * registration gates.
 */
export function atgDisplaySale<T extends AtgSaleFields & Pick<Sale, "startTime">>(
  sale: T,
  now: Date = new Date(),
): T {
  const state = atgCatalogState(sale);
  if (!state) return sale;
  return { ...sale, status: state === "ended" ? "ended" : liveStatus(sale.startTime, now) };
}

/** Lot state pill for ATG-owned sales; LAX lifecycle would read the draft lot as "Preview". */
export function atgLotBadge(state: "live" | "ended", sold: boolean | undefined): LifecycleBadgeVM {
  if (state === "live") return { label: "On ATG", tone: "live", pulse: false };
  if (sold === true) return { label: "Sold", tone: "ended", pulse: false };
  if (sold === false) return { label: "No sale", tone: "ended", pulse: false };
  return { label: "Ended on ATG", tone: "ended", pulse: false };
}

/** Display copy of a lot in an ATG-owned sale, with Sold/Unsold from the ATG result. */
export function atgDisplayLot<T extends Lot>(
  lot: T,
  sale: AtgSaleFields | null | undefined,
  now: Date = new Date(),
): T {
  return displayLotForState(lot, atgCatalogState(sale), now);
}

/** Public lot lists, where the API tags lots of ATG-owned sales with `atgSaleState`. */
export function atgDisplayListLot<T extends Lot>(lot: T, now: Date = new Date()): T {
  return displayLotForState(lot, lot.atgSaleState ?? null, now);
}

function displayLotForState<T extends Lot>(lot: T, state: "live" | "ended" | null, now: Date): T {
  if (!state || lot.status !== "draft") return lot;
  if (state === "live") return { ...lot, status: liveStatus(lot.startTime, now) };
  return { ...lot, status: "ended", winnerId: null, hasWinner: lot.atgSold === true };
}
