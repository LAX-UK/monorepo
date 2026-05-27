import type { SaleDeliveryMode } from "@auction/types";
import { auctionMinuteEpoch } from "./auction-datetime.js";
import { getSaleModeCapabilities } from "./sale-mode-policy.js";

/** Minimal sale schedule inputs for lot timing policy (DIP-friendly). */
export type LotSaleTimingWindow = {
  deliveryMode: SaleDeliveryMode;
  startTime: Date;
  endTime: Date;
};

export type LotTimingConflict = {
  lotId: string;
  title?: string | undefined;
  violation: string;
};

/** Align lot schedule to sale rules (onsite: inherit sale window; online: keep lot times). */
export function alignLotTimingWithSale(
  sale: LotSaleTimingWindow,
  lotStart: Date,
  lotEnd: Date,
): { startTime: Date; endTime: Date } {
  const caps = getSaleModeCapabilities(sale.deliveryMode);
  if (caps.inheritsLotTiming) {
    return { startTime: sale.startTime, endTime: sale.endTime };
  }
  return { startTime: lotStart, endTime: lotEnd };
}

/** Returns a user-facing message when lot times violate the sale window; null when valid. */
export function lotTimingViolationAgainstSale(
  sale: LotSaleTimingWindow,
  lotStart: Date,
  lotEnd: Date,
): string | null {
  const caps = getSaleModeCapabilities(sale.deliveryMode);
  const saleStartMinute = auctionMinuteEpoch(sale.startTime);
  const saleEndMinute = auctionMinuteEpoch(sale.endTime);
  const lotStartMinute = auctionMinuteEpoch(lotStart);
  const lotEndMinute = auctionMinuteEpoch(lotEnd);

  if (caps.inheritsLotTiming) {
    if (lotStartMinute !== saleStartMinute || lotEndMinute !== saleEndMinute) {
      return "Onsite lots must use the sale's start and end times";
    }
    return null;
  }
  if (lotStartMinute < saleStartMinute) {
    return "Lot start must not be before the sale start time";
  }
  if (lotEndMinute > saleEndMinute) {
    return "Lot end must not be after the sale end time";
  }
  return null;
}

/** Find lots whose schedule violates a sale window (all delivery modes). */
export function findLotTimingConflicts(
  sale: LotSaleTimingWindow,
  lots: readonly {
    id: string;
    title?: string | undefined;
    startTime: Date;
    endTime: Date;
  }[],
): LotTimingConflict[] {
  const conflicts: LotTimingConflict[] = [];
  for (const lot of lots) {
    const violation = lotTimingViolationAgainstSale(sale, lot.startTime, lot.endTime);
    if (violation) {
      conflicts.push({ lotId: lot.id, title: lot.title, violation });
    }
  }
  return conflicts;
}

/** Coerce (when required) then validate lot timing against a sale window. */
export function normalizeLotTimingForSale(
  sale: LotSaleTimingWindow,
  lotStart: Date,
  lotEnd: Date,
): { startTime: Date; endTime: Date; violation: string | null } {
  const aligned = alignLotTimingWithSale(sale, lotStart, lotEnd);
  const violation = lotTimingViolationAgainstSale(sale, aligned.startTime, aligned.endTime);
  return { startTime: aligned.startTime, endTime: aligned.endTime, violation };
}

export {
  instantFromAuctionDatetimeFormString,
  isStartInFutureForPublish,
  toAuctionDatetimeFormString,
} from "./auction-datetime.js";
