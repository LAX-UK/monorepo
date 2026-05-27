import type {
  SaleSetupLotRowContext,
  SaleSetupLotRowFormValues,
} from "@/lib/admin/sale-setup/lot-row-schema";
import { safeParseSaleSetupLotRowForApi } from "@/lib/admin/sale-setup/lot-row-schema";
import type { Lot } from "@auction/types";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  type createNestedLotForSaleSchema,
  lotTimingViolationAgainstSale,
  saleModeInheritsLotTiming,
} from "@auction/validators";
import type { z } from "zod";

export type AttachReviewApiPayload = z.infer<typeof createNestedLotForSaleSchema>;

export function inventoryLotToAttachReviewRow(
  lot: Lot,
  clientRowId: string,
): SaleSetupLotRowFormValues {
  return {
    clientRowId,
    source: "existing",
    title: lot.title,
    sellerLegalEntityId: lot.sellerLegalEntityId ?? "",
    categoryIds:
      lot.categoryIds && lot.categoryIds.length > 0
        ? lot.categoryIds
        : lot.categoryId
          ? [lot.categoryId]
          : [],
    auctionType: lot.auctionType,
    startingPrice: lot.startingPrice,
    artistId: lot.artistId ?? null,
    startTime: toDatetimeFormString(lot.startTime),
    endTime: toDatetimeFormString(lot.endTime),
  };
}

export function attachReviewScheduleChanged(
  original: Pick<Lot, "startTime" | "endTime">,
  values: Pick<SaleSetupLotRowFormValues, "startTime" | "endTime">,
): boolean {
  const startRaw = values.startTime?.trim();
  const endRaw = values.endTime?.trim();
  if (!startRaw || !endRaw) return false;
  const startTime = instantFromDatetimeFormString(startRaw);
  const endTime = instantFromDatetimeFormString(endRaw);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) return false;
  return (
    startTime.getTime() !== original.startTime.getTime() ||
    endTime.getTime() !== original.endTime.getTime()
  );
}

export type AttachReviewFieldErrors = Partial<
  Record<keyof SaleSetupLotRowFormValues | "startTime" | "endTime", string>
>;

export function validateAttachReviewSchedule(
  values: SaleSetupLotRowFormValues,
  ctx: SaleSetupLotRowContext,
):
  | { ok: true; payload: AttachReviewApiPayload }
  | { ok: false; fieldErrors: AttachReviewFieldErrors } {
  const parsed = safeParseSaleSetupLotRowForApi(values, ctx);
  if (parsed.success) {
    return { ok: true, payload: parsed.data };
  }
  const fieldErrors: AttachReviewFieldErrors = {};
  for (const iss of parsed.error.issues) {
    const path = (iss.path.join(".") || "startTime") as keyof AttachReviewFieldErrors;
    fieldErrors[path] = iss.message;
  }
  return { ok: false, fieldErrors };
}

export function attachReviewScheduleViolation(
  values: Pick<SaleSetupLotRowFormValues, "startTime" | "endTime">,
  ctx: SaleSetupLotRowContext,
): string | null {
  if (saleModeInheritsLotTiming(ctx.deliveryMode)) return null;
  const startRaw = values.startTime?.trim();
  const endRaw = values.endTime?.trim();
  if (!startRaw || !endRaw) return "Choose lot opening and closing times";
  const startTime = instantFromDatetimeFormString(startRaw);
  const endTime = instantFromDatetimeFormString(endRaw);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return "Choose valid lot opening and closing times";
  }
  return lotTimingViolationAgainstSale(
    {
      deliveryMode: ctx.deliveryMode,
      startTime: ctx.saleStartTime,
      endTime: ctx.saleEndTime,
    },
    startTime,
    endTime,
  );
}
