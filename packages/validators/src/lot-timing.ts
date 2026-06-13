import type { LotCardTimingVM, LotTimingSource } from "@auction/types";
import { normalizeAuctionTime } from "./auction-timing.js";

/** @deprecated Use `normalizeAuctionTime` — kept for lot-domain call sites. */
export const normalizeLotTime = normalizeAuctionTime;

/** Normalize both lot timing fields. */
export function normalizeLotTimingFields(
  lot: Pick<LotTimingSource, "startTime" | "endTime">,
): Pick<LotCardTimingVM, "startTime" | "endTime"> {
  return {
    startTime: normalizeAuctionTime(lot.startTime),
    endTime: normalizeAuctionTime(lot.endTime),
  };
}

/** Canonical mapper: raw lot timing → normalized catalogue VM fields. */
export function toLotCardTimingVM(source: LotTimingSource): LotCardTimingVM {
  return {
    status: source.status,
    ...normalizeLotTimingFields(source),
  };
}
