import type { LotAuctionType, SaleDeliveryMode } from "@auction/types";
import { createNestedLotForSaleSchema, getSaleModeCapabilities } from "@auction/validators";
import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price (e.g. 100.00)");

/** Wizard lot row — slim subset for step 4. */
export const saleSetupLotRowFormSchema = z.object({
  clientRowId: z.string().min(1),
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

export function saleSetupLotRowToApiPayload(
  row: SaleSetupLotRowFormValues,
  ctx: SaleSetupLotRowContext,
): z.infer<typeof createNestedLotForSaleSchema> {
  const caps = getSaleModeCapabilities(ctx.deliveryMode);
  const start = caps.inheritsLotTiming
    ? ctx.saleStartTime
    : row.startTime?.trim()
      ? new Date(row.startTime)
      : ctx.saleStartTime;
  const end = caps.inheritsLotTiming
    ? ctx.saleEndTime
    : row.endTime?.trim()
      ? new Date(row.endTime)
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
  }

  const payload = saleSetupLotRowToApiPayload(formParsed.data, ctx);
  return createNestedLotForSaleSchema.safeParse(payload);
}
