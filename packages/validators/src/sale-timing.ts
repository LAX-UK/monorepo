import type {
  OptionalIsoTime,
  SaleCardTimingVM,
  SaleDeliveryMode,
  SaleTimingSource,
  SaleTimingValue,
} from "@auction/types";
import {
  normalizeAuctionTime,
  toActiveCountdownEndIso,
  toOptionalIsoString,
} from "./auction-timing.js";

/** @deprecated Use `normalizeAuctionTime`. */
export const normalizeSaleTime = normalizeAuctionTime;

export function normalizeSaleTimingFields(
  sale: Pick<SaleTimingSource, "startTime" | "endTime">,
): Pick<SaleCardTimingVM, "startTime" | "endTime"> {
  return {
    startTime: normalizeAuctionTime(sale.startTime),
    endTime: normalizeAuctionTime(sale.endTime),
  };
}

/** Canonical mapper: raw sale timing → normalized card/hero VM fields. */
export function toSaleCardTimingVM(source: SaleTimingSource): SaleCardTimingVM {
  return {
    status: source.status,
    ...normalizeSaleTimingFields(source),
  };
}

/** ISO end instant for live-sale countdown badges. */
export function toSaleCountdownEndIso(
  source: {
    status: SaleTimingSource["status"];
    endTime: SaleTimingValue;
    deliveryMode?: SaleDeliveryMode;
  },
  opts?: { now?: Date },
): OptionalIsoTime {
  return toActiveCountdownEndIso(source.status, source.endTime, {
    ...(source.deliveryMode != null ? { deliveryMode: source.deliveryMode } : {}),
    ...(opts?.now != null ? { now: opts.now } : {}),
  });
}

/** Optional preview-open ISO for sale heroes and agendas. */
export function toSalePreviewStartIso(previewStartTime: SaleTimingValue): OptionalIsoTime {
  return toOptionalIsoString(previewStartTime);
}
