import type { LotAuctionType, SaleDeliveryMode } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  createNestedLotForSaleSchema,
  getSaleModeCapabilities,
  lotTimingViolationAgainstSale,
} from "@auction/validators";
import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price (e.g. 100.00)");

/** Wizard lot row — slim subset for step 4. */
export const saleSetupLotRowFormSchema = z.object({
  clientRowId: z.string().min(1),
  source: z.enum(["new", "existing"]).default("new"),
  lotId: z.string().uuid().optional(),
  title: z.string().min(1, "Enter a lot title").max(500),
  sellerLegalEntityId: z.string().uuid("Choose a seller"),
  sellerDisplayName: z.string().optional(),
  categoryIds: z
    .array(z.string().uuid())
    .min(1, "Pick at least one category")
    .max(8, "Choose no more than 8 categories"),
  auctionType: z.enum(["english", "dutch", "sealed", "buy_it_now"] as const),
  startingPrice: decimalString,
  artistId: z.string().uuid().nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export type SaleSetupLotRowFormValues = z.infer<typeof saleSetupLotRowFormSchema>;

export type SaleSetupLotRowContext = {
  saleStartTime: Date;
  saleEndTime: Date;
  deliveryMode: SaleDeliveryMode;
  englishOnlyAuctionsLocked: boolean;
};

export function emptySaleSetupLotRow(clientRowId: string): SaleSetupLotRowFormValues {
  return {
    clientRowId,
    source: "new",
    title: "",
    sellerLegalEntityId: "",
    categoryIds: [],
    auctionType: "english",
    startingPrice: "0.00",
    artistId: null,
    startTime: "",
    endTime: "",
  };
}

export function mergeSavedLotRow(
  row: SaleSetupLotRowFormValues,
  lotId: string,
  meta?: { title?: string },
): SaleSetupLotRowFormValues {
  return {
    ...row,
    lotId,
    title: meta?.title ?? row.title,
    source: row.source === "existing" ? "existing" : row.source,
  };
}

export function mergeWizardRowsWithServerLots<T extends { id: string }>(
  currentRows: SaleSetupLotRowFormValues[],
  serverLots: T[],
  lotToRow: (lot: T) => SaleSetupLotRowFormValues,
): SaleSetupLotRowFormValues[] {
  const unsaved = currentRows.filter((r) => !r.lotId);
  const prevByLotId = new Map(currentRows.flatMap((r) => (r.lotId ? [[r.lotId, r] as const] : [])));
  const existingAttachedIds = new Set(
    currentRows.flatMap((r) => (r.source === "existing" && r.lotId ? [r.lotId] : [])),
  );
  const serverRows = serverLots.map((lot) => {
    const prev = prevByLotId.get(lot.id);
    const row = lotToRow(lot);
    const source = existingAttachedIds.has(lot.id) ? ("existing" as const) : row.source;
    if (!prev) {
      return source === row.source ? row : { ...row, source };
    }
    return {
      ...row,
      clientRowId: prev.clientRowId,
      source,
      ...(prev.sellerDisplayName ? { sellerDisplayName: prev.sellerDisplayName } : {}),
    };
  });
  if (serverRows.length === 0 && unsaved.length === 0) {
    return [];
  }
  return [...serverRows, ...unsaved];
}

export function saleSetupLotRowToApiPayload(
  row: SaleSetupLotRowFormValues,
  ctx: SaleSetupLotRowContext,
): z.infer<typeof createNestedLotForSaleSchema> {
  const caps = getSaleModeCapabilities(ctx.deliveryMode);
  const start = caps.inheritsLotTiming
    ? ctx.saleStartTime
    : row.startTime?.trim()
      ? instantFromDatetimeFormString(row.startTime)
      : ctx.saleStartTime;
  const end = caps.inheritsLotTiming
    ? ctx.saleEndTime
    : row.endTime?.trim()
      ? instantFromDatetimeFormString(row.endTime)
      : ctx.saleEndTime;

  return {
    title: row.title.trim(),
    sellerId: row.sellerLegalEntityId,
    categoryIds: row.categoryIds,
    auctionType: row.auctionType as LotAuctionType,
    startingPrice: row.startingPrice.trim(),
    startTime: start,
    endTime: end,
    ...(row.artistId ? { artistId: row.artistId } : {}),
  };
}

export function safeParseSaleSetupLotRowForApi(
  row: SaleSetupLotRowFormValues,
  ctx: SaleSetupLotRowContext,
) {
  const formParsed = saleSetupLotRowFormSchema.safeParse(row);
  if (!formParsed.success) return formParsed;

  if (ctx.englishOnlyAuctionsLocked && formParsed.data.auctionType !== "english") {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Only English auction lots are allowed for this sale",
          path: ["auctionType"],
        },
      ]),
    };
  }

  const caps = getSaleModeCapabilities(ctx.deliveryMode);
  if (!caps.inheritsLotTiming) {
    if (!row.startTime?.trim()) {
      return {
        success: false as const,
        error: new z.ZodError([
          { code: "custom", message: "Choose a lot opening time", path: ["startTime"] },
        ]),
      };
    }
    if (!row.endTime?.trim()) {
      return {
        success: false as const,
        error: new z.ZodError([
          { code: "custom", message: "Choose a lot closing time", path: ["endTime"] },
        ]),
      };
    }

    const lotStart = instantFromDatetimeFormString(row.startTime);
    const lotEnd = instantFromDatetimeFormString(row.endTime);
    if (Number.isNaN(lotStart.getTime()) || Number.isNaN(lotEnd.getTime())) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            message: "Choose valid lot opening and closing times",
            path: ["startTime"],
          },
        ]),
      };
    }
    if (lotEnd <= lotStart) {
      return {
        success: false as const,
        error: new z.ZodError([
          { code: "custom", message: "Closing time must be after opening time", path: ["endTime"] },
        ]),
      };
    }

    const violation = lotTimingViolationAgainstSale(
      {
        deliveryMode: ctx.deliveryMode,
        startTime: ctx.saleStartTime,
        endTime: ctx.saleEndTime,
      },
      lotStart,
      lotEnd,
    );
    if (violation) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: "custom",
            message: violation,
            path: violation.includes("start") ? ["startTime"] : ["endTime"],
          },
        ]),
      };
    }
  }

  const payload = saleSetupLotRowToApiPayload(formParsed.data, ctx);
  return createNestedLotForSaleSchema.safeParse(payload);
}
