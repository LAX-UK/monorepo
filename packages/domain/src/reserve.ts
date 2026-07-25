import { moneyGte } from "./money-compare.js";

export type ReserveStatus =
  | { kind: "none" }
  | { kind: "below"; hasReserve: true }
  | { kind: "met"; hasReserve: true };

export type NoSaleReason = "reserve_not_met" | "no_bids" | "clerk_passed" | "voided";

export type LotEndedTrigger = "timed" | "clerk_hammer" | "clerk_no_sale" | "early_close";

/** True when a positive reserve price is configured on the lot. */
export function hasConfiguredReserve(reservePrice: string | null | undefined): boolean {
  if (reservePrice == null || reservePrice === "") return false;
  const trimmed = reservePrice.trim();
  if (!trimmed) return false;
  return moneyGte(trimmed, "0.01");
}

/** Compare current hammer against reserve using string money (no float drift). */
export function deriveReserveStatus(
  currentPrice: string,
  reservePrice: string | null | undefined,
): ReserveStatus {
  if (!hasConfiguredReserve(reservePrice)) {
    return { kind: "none" };
  }
  const reserve = (reservePrice ?? "").trim();
  if (moneyGte(currentPrice, reserve)) {
    return { kind: "met", hasReserve: true };
  }
  return { kind: "below", hasReserve: true };
}

/** Whether the current hammer meets or exceeds the configured reserve. */
export function isReserveMet(
  currentPrice: string,
  reservePrice: string | null | undefined,
): boolean | null {
  const status = deriveReserveStatus(currentPrice, reservePrice);
  if (status.kind === "none") return null;
  return status.kind === "met";
}

export function deriveNoSaleReason(input: {
  reserveStatus: ReserveStatus;
  hadBids: boolean;
  trigger?: LotEndedTrigger;
  voided?: boolean;
}): NoSaleReason {
  if (input.voided) return "voided";
  if (input.trigger === "clerk_no_sale") return "clerk_passed";
  if (!input.hadBids) return "no_bids";
  if (input.reserveStatus.kind === "below") return "reserve_not_met";
  // kind === "none" (no reserve) or kind === "met" (reserve satisfied) with bids but no winner
  // can only happen via a clerk pass (clerk_hammer without a winning bid is treated as no_sale).
  return "clerk_passed";
}
