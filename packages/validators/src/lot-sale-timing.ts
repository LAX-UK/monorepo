import type { SaleDeliveryMode } from "@auction/types";
import { getSaleModeCapabilities } from "./sale-mode-policy.js";

/** Minimal sale schedule inputs for lot timing policy (DIP-friendly). */
export type LotSaleTimingWindow = {
  deliveryMode: SaleDeliveryMode;
  startTime: Date;
  endTime: Date;
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
  if (caps.inheritsLotTiming) {
    if (
      lotStart.getTime() !== sale.startTime.getTime() ||
      lotEnd.getTime() !== sale.endTime.getTime()
    ) {
      return "Onsite lots must use the sale's start and end times";
    }
    return null;
  }
  if (lotStart.getTime() < sale.startTime.getTime()) {
    return "Lot start must not be before the sale start time";
  }
  if (lotEnd.getTime() > sale.endTime.getTime()) {
    return "Lot end must not be after the sale end time";
  }
  return null;
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
