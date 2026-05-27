import type { Lot, Sale } from "@auction/types";
import { getSaleModeCapabilities, isStartInFutureForPublish } from "@auction/validators";
import { LotError } from "./errors.js";
import { resolveLotTimingForSale } from "./lot-sale-timing.js";

export type LotPublishTimingResolution = {
  startTime: Date;
  endTime: Date;
  /** When lot DB times should be updated before publish. */
  alignedPatch?: { startTime: Date; endTime: Date };
};

export type AssertLotPublishableOptions = {
  /** Require images and description (individual lot publish). Default true. */
  requireCatalogue?: boolean;
  /** Sale context when the lot is attached; pass `null` for standalone lots. */
  sale: Sale | null;
  /** When true (default), blocks publish while the sale is still draft. */
  rejectDraftSale?: boolean;
};

export function assertLotPublishable(
  lot: Lot,
  options: AssertLotPublishableOptions,
): { ok: true; timing: LotPublishTimingResolution } | { ok: false; error: LotError } {
  const { requireCatalogue = true, sale, rejectDraftSale = true } = options;

  if (lot.status !== "draft") {
    return { ok: false, error: new LotError("Only draft lots can be published") };
  }
  if (requireCatalogue) {
    if (lot.images.length === 0) {
      return {
        ok: false,
        error: new LotError("Add at least one image before publishing this lot"),
      };
    }
    if (!lot.description?.trim()) {
      return {
        ok: false,
        error: new LotError("Add a catalogue description before publishing this lot"),
      };
    }
  }

  if (sale) {
    if (rejectDraftSale && sale.status === "draft") {
      return {
        ok: false,
        error: new LotError(
          "Publish this lot with the sale when the sale goes live",
          409,
          "use_sale_publish",
        ),
      };
    }
    const resolved = resolveLotTimingForSale(sale, lot.startTime, lot.endTime);
    if (!resolved.ok) {
      return { ok: false, error: new LotError(resolved.message, 400) };
    }
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    if (!caps.inheritsLotTiming && !isStartInFutureForPublish(resolved.startTime)) {
      return { ok: false, error: new LotError("startTime must be in the future to publish") };
    }
    const alignedPatch =
      resolved.startTime.getTime() !== lot.startTime.getTime() ||
      resolved.endTime.getTime() !== lot.endTime.getTime()
        ? { startTime: resolved.startTime, endTime: resolved.endTime }
        : undefined;
    return {
      ok: true,
      timing: {
        startTime: resolved.startTime,
        endTime: resolved.endTime,
        ...(alignedPatch ? { alignedPatch } : {}),
      },
    };
  }

  if (!isStartInFutureForPublish(lot.startTime)) {
    return { ok: false, error: new LotError("startTime must be in the future to publish") };
  }
  return {
    ok: true,
    timing: { startTime: lot.startTime, endTime: lot.endTime },
  };
}
