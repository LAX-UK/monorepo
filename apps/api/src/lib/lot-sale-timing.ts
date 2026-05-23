import type { CreateLotInput, Lot, Sale } from "@auction/types";
import { normalizeLotTimingForSale } from "@auction/validators";

export type LotTimingResolution =
  | { ok: true; startTime: Date; endTime: Date }
  | { ok: false; message: string };

export function resolveLotTimingForSale(
  sale: Sale,
  lotStart: Date,
  lotEnd: Date,
): LotTimingResolution {
  const { startTime, endTime, violation } = normalizeLotTimingForSale(sale, lotStart, lotEnd);
  if (violation) {
    return { ok: false, message: violation };
  }
  return { ok: true, startTime, endTime };
}

export function mergeSaleTimingIntoPatch(
  _sale: Sale,
  _lot: Pick<Lot, "startTime" | "endTime">,
  patch: Partial<CreateLotInput>,
  timing: { startTime: Date; endTime: Date },
): Partial<CreateLotInput> {
  return { ...patch, startTime: timing.startTime, endTime: timing.endTime };
}

/** Validates (and coerces when onsite) lot schedule against a sale window. */
export function lotTimingViolationForSale(sale: Sale, lotStart: Date, lotEnd: Date): string | null {
  return normalizeLotTimingForSale(sale, lotStart, lotEnd).violation;
}
