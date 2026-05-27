import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { Lot, Sale, SaleDeliveryMode } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  findLotTimingConflicts,
  getSaleModeCapabilities,
  instantFromAuctionDatetimeFormString,
  toAuctionDatetimeFormString,
} from "@auction/validators";

export type SaleWindow = {
  deliveryMode: SaleDeliveryMode;
  startTime: Date;
  endTime: Date;
};

export type LotWindowConflict = {
  lot: Pick<Lot, "id" | "title" | "startTime" | "endTime">;
  violation: string;
};

export function parseSaleWindowFromForm(
  values: Pick<AdminSaleFormValues, "deliveryMode" | "startTime" | "endTime">,
): SaleWindow | null {
  const startTime = instantFromDatetimeFormString(values.startTime);
  const endTime = instantFromDatetimeFormString(values.endTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return null;
  }
  if (endTime <= startTime) return null;
  return {
    deliveryMode: values.deliveryMode,
    startTime,
    endTime,
  };
}

export function parseSaleWindowFromSale(
  sale: Pick<Sale, "deliveryMode" | "startTime" | "endTime">,
): SaleWindow {
  return {
    deliveryMode: sale.deliveryMode,
    startTime: sale.startTime,
    endTime: sale.endTime,
  };
}

export function findLotsOutsideSaleWindow(
  lots: readonly Pick<Lot, "id" | "title" | "startTime" | "endTime">[],
  window: SaleWindow,
): LotWindowConflict[] {
  return findLotTimingConflicts(window, lots).map(({ lotId, title, violation }) => {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) {
      return {
        lot: {
          id: lotId,
          title: title ?? "Untitled lot",
          startTime: window.startTime,
          endTime: window.endTime,
        },
        violation,
      };
    }
    return { lot, violation };
  });
}

const MIN_LOT_DURATION_MS = 60_000;

function toAuctionMinuteInstant(instant: Date): Date {
  return instantFromAuctionDatetimeFormString(toAuctionDatetimeFormString(instant));
}

/** Clamp lot open/close into the sale window; preserve duration when possible. */
export function proposeLotTimesWithinWindow(
  lot: Pick<Lot, "startTime" | "endTime">,
  window: SaleWindow,
): { startTime: Date; endTime: Date } {
  const caps = getSaleModeCapabilities(window.deliveryMode);
  if (caps.inheritsLotTiming) {
    return {
      startTime: toAuctionMinuteInstant(window.startTime),
      endTime: toAuctionMinuteInstant(window.endTime),
    };
  }

  const saleStart = toAuctionMinuteInstant(window.startTime).getTime();
  const saleEnd = toAuctionMinuteInstant(window.endTime).getTime();
  const lotStartMinute = toAuctionMinuteInstant(lot.startTime).getTime();
  const lotEndMinute = toAuctionMinuteInstant(lot.endTime).getTime();
  const duration = Math.max(lotEndMinute - lotStartMinute, MIN_LOT_DURATION_MS);

  let startTime = new Date(Math.max(lotStartMinute, saleStart));
  let endTime = new Date(startTime.getTime() + duration);

  if (endTime.getTime() > saleEnd) {
    endTime = new Date(saleEnd);
    startTime = new Date(Math.max(saleStart, endTime.getTime() - duration));
  }

  if (endTime.getTime() <= startTime.getTime()) {
    startTime = new Date(saleStart);
    endTime = new Date(Math.min(saleEnd, saleStart + MIN_LOT_DURATION_MS));
    if (endTime.getTime() <= startTime.getTime()) {
      endTime = new Date(saleEnd);
    }
  }

  return {
    startTime: toAuctionMinuteInstant(startTime),
    endTime: toAuctionMinuteInstant(endTime),
  };
}

export function formatLotWindowConflictMessage(conflicts: readonly LotWindowConflict[]): string {
  if (conflicts.length === 0) return "";
  const titles = conflicts.map((c) => c.lot.title.trim() || "Untitled lot");
  const shown = titles.slice(0, 3);
  const suffix = titles.length > 3 ? ` and ${titles.length - 3} more` : "";
  const humanized = humanizeSetupError({ message: conflicts[0]?.violation ?? "" });
  if (conflicts.length === 1) {
    return `${shown[0]}: ${humanized}`;
  }
  return `${shown.join(", ")}${suffix} — ${humanized}`;
}
