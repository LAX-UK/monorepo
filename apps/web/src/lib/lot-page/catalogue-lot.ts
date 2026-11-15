import type { Lot, PublicLotView } from "@auction/types";

/**
 * The lot with everything bidding moves taken out (CO-7): the public lot and sale pages are built
 * from cached reads, so their HTML must carry no live bid state. What the page hands to the
 * browser is the catalogue lot; the price, status, close, winner and result come from the live
 * (no-store) read and the socket.
 *
 * The fields keep their types with neutral values: the opening price for the price, `scheduled`
 * for the status, the opening time for the close, and no winner or result.
 */
export function withoutLiveBidState<T extends Lot | PublicLotView>(lot: T): T {
  const {
    hasWinner: _hasWinner,
    resultPending: _resultPending,
    checkoutPricing: _checkoutPricing,
    ...rest
  } = lot as T & { checkoutPricing?: unknown };
  return {
    ...rest,
    status: "scheduled",
    currentPrice: lot.startingPrice,
    endTime: lot.startTime,
    winnerId: null,
    ...("extendedUntil" in lot ? { extendedUntil: null } : {}),
    ...("dutchLastDecrementAt" in lot ? { dutchLastDecrementAt: null } : {}),
    ...("buyerLegalEntityId" in lot ? { buyerLegalEntityId: null } : {}),
    ...("reserveMet" in lot ? { reserveMet: null } : {}),
  } as T;
}

/** The fields `withoutLiveBidState` neutralises, for the guard tests. */
export const LIVE_BID_FIELDS = [
  "status",
  "currentPrice",
  "endTime",
  "winnerId",
  "hasWinner",
  "resultPending",
  "checkoutPricing",
  "extendedUntil",
  "reserveMet",
] as const;
