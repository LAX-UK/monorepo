import { type CreateLotInput, lotAuctionTypes } from "@auction/types";
import type { SaleDeliveryMode } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  createLotSchema,
  getSaleModeCapabilities,
  lotTimingViolationAgainstSale,
  mediaReferenceSchema,
  moneyGte,
  moneyLt,
  updateLotSchema,
} from "@auction/validators";
import type { z } from "zod";
import { z as zod } from "zod";
import { optionalBuyerPremiumRateSchema } from "./buyer-premium-rate";
import { framedSizeIssues, readFramedCm } from "./lot-framed-size";

const decimalString = zod
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount in pounds, like 1200.00");

const optionalStr = zod.union([zod.string(), zod.literal("")]);

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !decimalString.safeParse(trimmed).success) return null;
  return Number.parseFloat(trimmed);
}

function refineLotFieldsByAuctionType(
  values: zod.infer<typeof adminLotFormValuesSchema>,
  ctx: zod.RefinementCtx,
) {
  if (values.auctionType === "dutch") {
    const amount = values.dutchDecrementAmount?.trim() ?? "";
    if (!amount) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Enter the amount the price drops each time",
        path: ["dutchDecrementAmount"],
      });
    } else if (!decimalString.safeParse(amount).success) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Enter an amount in pounds, like 1200.00",
        path: ["dutchDecrementAmount"],
      });
    }
    const intervalRaw = values.dutchDecrementIntervalMs?.trim() ?? "";
    if (!intervalRaw) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Enter how often the price drops, in milliseconds",
        path: ["dutchDecrementIntervalMs"],
      });
    } else {
      const interval = Number.parseInt(intervalRaw, 10);
      if (!Number.isFinite(interval) || interval < 1000 || interval > 86_400_000) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "Interval must be between 1,000 and 86,400,000 ms",
          path: ["dutchDecrementIntervalMs"],
        });
      }
    }
  }

  if (values.auctionType === "buy_it_now") {
    const buyNow = values.buyNowPrice?.trim() ?? "";
    if (!buyNow) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Enter the buy now price",
        path: ["buyNowPrice"],
      });
    } else if (!decimalString.safeParse(buyNow).success) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Enter an amount in pounds, like 1200.00",
        path: ["buyNowPrice"],
      });
    } else {
      const start = parseDecimal(values.startingPrice);
      const buy = parseDecimal(buyNow);
      if (start !== null && buy !== null && buy < start) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "Buy now price must be at least the list / floor price",
          path: ["buyNowPrice"],
        });
      }
    }
  }
}

const optionalDecimal = zod.union([decimalString, zod.literal("")]);

/** Aligned with admin create/edit lot pages (datetime-local strings). */
export const adminLotFormValuesSchema = zod
  .object({
    title: zod
      .string()
      .min(1, "Enter a title")
      .max(500, "Shorten the title to 500 characters or fewer"),
    description: optionalStr,
    medium: optionalStr,
    dimensions: optionalStr,
    /** The photograph shows the work in its frame, so its size is the framed size. */
    photoIncludesFrame: zod.boolean(),
    /** Framed size in centimetres as typed; both sides or neither. */
    framedWidthCm: optionalStr,
    framedHeightCm: optionalStr,
    /** Legal entity id — replaces legacy user-based sellerId. */
    sellerLegalEntityId: zod.string().uuid("Choose the seller"),
    /** Display label for the picker chip (not sent to API). */
    sellerDisplayName: zod.string().optional(),
    categoryIds: zod
      .array(zod.string().uuid())
      .min(1, "Choose at least one category")
      .max(8, "Choose no more than 8 categories"),
    saleId: zod.string().uuid("Choose the sale this lot is in"),
    lotNumber: zod
      .union([zod.coerce.number().int().positive(), zod.literal("")])
      .nullable()
      .optional(),
    auctionType: zod.enum(lotAuctionTypes),
    startingPrice: decimalString,
    reservePrice: optionalDecimal,
    buyNowPrice: optionalDecimal,
    buyerPremiumRate: optionalBuyerPremiumRateSchema,
    minBidIncrement: optionalDecimal,
    autoBidEnabled: zod.boolean().optional(),
    autoBidStepMin: optionalDecimal,
    autoBidStepMax: optionalDecimal,
    /** Comma-separated preset steps (e.g. "10,25,50") — parsed on submit. */
    autoBidStepPresetsCsv: optionalStr,
    dutchDecrementAmount: optionalDecimal,
    dutchDecrementIntervalMs: optionalStr,
    images: zod.array(mediaReferenceSchema).max(50),
    imageAlts: zod.array(zod.string().max(500)).max(50),
    startTime: zod.string().min(1, "Enter when bidding opens"),
    endTime: zod.string().min(1, "Enter when bidding closes"),
    artistId: zod.string().uuid().nullable().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.description && values.description.length > 10_000) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Description is too long",
        path: ["description"],
      });
    }
    if (values.medium && values.medium.length > 500) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Medium is too long",
        path: ["medium"],
      });
    }
    if (values.dimensions && values.dimensions.length > 200) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Dimensions text is too long",
        path: ["dimensions"],
      });
    }
    for (const issue of framedSizeIssues(values.framedWidthCm, values.framedHeightCm)) {
      ctx.addIssue({ code: zod.ZodIssueCode.custom, message: issue.message, path: [issue.field] });
    }
    const start = instantFromDatetimeFormString(values.startTime);
    const end = instantFromDatetimeFormString(values.endTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Bidding must close after it opens",
        path: ["endTime"],
      });
    }
    refineLotFieldsByAuctionType(values, ctx);
    const starting = values.startingPrice?.trim();
    const reserve = values.reservePrice?.trim();
    if (starting && reserve && moneyLt(reserve, starting)) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Reserve must be at least the starting price",
        path: ["reservePrice"],
      });
    }
    const buyNow = values.buyNowPrice?.trim();
    const floor =
      starting && reserve
        ? moneyGte(reserve, starting)
          ? reserve
          : starting
        : (reserve ?? starting);
    if (buyNow && floor && moneyLt(buyNow, floor)) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Buy now price must be at least the reserve (or starting price when no reserve)",
        path: ["buyNowPrice"],
      });
    }
  });

/** Sale metadata used to validate lot schedule against the assigned sale window. */
export type AdminLotFormSaleTiming = {
  id: string;
  deliveryMode: SaleDeliveryMode;
  startTime: Date;
  endTime: Date;
};

export function refineLotTimingForAssignedSale(
  values: AdminLotFormValues,
  salesById: ReadonlyMap<string, AdminLotFormSaleTiming>,
  ctx: zod.RefinementCtx,
) {
  if (!values.saleId) return;
  const sale = salesById.get(values.saleId);
  if (!sale) return;
  const start = instantFromDatetimeFormString(values.startTime);
  const end = instantFromDatetimeFormString(values.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  const window = {
    deliveryMode: sale.deliveryMode,
    startTime: sale.startTime,
    endTime: sale.endTime,
  };
  const caps = getSaleModeCapabilities(sale.deliveryMode);
  const checkStart = caps.inheritsLotTiming ? sale.startTime : start;
  const checkEnd = caps.inheritsLotTiming ? sale.endTime : end;
  const violation = lotTimingViolationAgainstSale(window, checkStart, checkEnd);
  if (!violation) return;

  ctx.addIssue({
    code: zod.ZodIssueCode.custom,
    message: violation,
    path: caps.inheritsLotTiming
      ? ["startTime"]
      : violation.includes("start")
        ? ["startTime"]
        : ["endTime"],
  });
}

export function buildAdminLotFormSchema(salesById: ReadonlyMap<string, AdminLotFormSaleTiming>) {
  return adminLotFormValuesSchema.superRefine((values, ctx) => {
    refineLotTimingForAssignedSale(values, salesById, ctx);
  });
}

export type AdminLotFormValues = zod.infer<typeof adminLotFormValuesSchema>;

function parseAutoBidPresetsCsv(raw: string | undefined): number[] | null | undefined {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return undefined;
  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map((p) => Number.parseFloat(p));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return undefined;
  return nums;
}

/** The framed size for the API: numbers, with an update clearing it by sending null. */
function framedSizePayload(v: AdminLotFormValues, forUpdate: boolean) {
  const width = readFramedCm(v.framedWidthCm);
  const height = readFramedCm(v.framedHeightCm);
  const w = width.ok ? width.value : null;
  const h = height.ok ? height.value : null;
  if (w === null && h === null)
    return forUpdate ? { framedWidthCm: null, framedHeightCm: null } : {};
  return { framedWidthCm: w, framedHeightCm: h };
}

function buildCreateLotRaw(v: AdminLotFormValues, opts?: { forUpdate?: boolean }) {
  const lotNumberRaw =
    v.lotNumber !== null && v.lotNumber !== undefined && v.lotNumber !== ""
      ? Number(v.lotNumber)
      : undefined;
  return {
    title: v.title.trim(),
    description: (v.description && String(v.description).trim()) || undefined,
    medium: (v.medium && String(v.medium).trim()) || undefined,
    dimensions: (v.dimensions && String(v.dimensions).trim()) || undefined,
    photoIncludesFrame: v.photoIncludesFrame,
    ...framedSizePayload(v, opts?.forUpdate === true),
    sellerLegalEntityId: v.sellerLegalEntityId.trim(),
    categoryIds: v.categoryIds,
    auctionType: v.auctionType,
    startingPrice: v.startingPrice.trim(),
    reservePrice: (v.reservePrice && String(v.reservePrice).trim()) || undefined,
    buyNowPrice: (v.buyNowPrice && String(v.buyNowPrice).trim()) || undefined,
    buyerPremiumRate: (v.buyerPremiumRate && String(v.buyerPremiumRate).trim()) || undefined,
    minBidIncrement: (v.minBidIncrement && String(v.minBidIncrement).trim()) || undefined,
    autoBidEnabled: v.autoBidEnabled,
    autoBidStepMin: (v.autoBidStepMin && String(v.autoBidStepMin).trim()) || undefined,
    autoBidStepMax: (v.autoBidStepMax && String(v.autoBidStepMax).trim()) || undefined,
    autoBidStepPresets: parseAutoBidPresetsCsv(v.autoBidStepPresetsCsv),
    dutchDecrementAmount:
      (v.dutchDecrementAmount && String(v.dutchDecrementAmount).trim()) || undefined,
    dutchDecrementIntervalMs:
      v.dutchDecrementIntervalMs && String(v.dutchDecrementIntervalMs).trim()
        ? Number.parseInt(String(v.dutchDecrementIntervalMs).trim(), 10)
        : undefined,
    images: opts?.forUpdate ? v.images : v.images.length > 0 ? v.images : undefined,
    startTime: instantFromDatetimeFormString(v.startTime),
    endTime: instantFromDatetimeFormString(v.endTime),
    saleId: v.saleId,
    ...(lotNumberRaw !== undefined ? { lotNumber: lotNumberRaw } : {}),
    ...(v.artistId !== undefined ? { artistId: v.artistId } : {}),
  } satisfies z.input<typeof createLotSchema>;
}

export function formValuesToImageAltsPatch(v: AdminLotFormValues): {
  imageAlts: string[] | null;
} {
  const imageAlts = v.images.map((_, index) => (v.imageAlts[index] ?? "").trim());
  return {
    imageAlts: imageAlts.some((alt) => alt.length > 0) ? imageAlts : null,
  };
}

/** Client + server: map form → API; use `data` on success. */
export function safeParseCreateLotFromForm(v: AdminLotFormValues) {
  return createLotSchema.safeParse(buildCreateLotRaw(v));
}

export function formValuesToCreateLotInput(v: AdminLotFormValues): CreateLotInput {
  return createLotSchema.parse(buildCreateLotRaw(v));
}

export function safeParseUpdateLotFromForm(v: AdminLotFormValues) {
  const createParsed = createLotSchema.safeParse(buildCreateLotRaw(v, { forUpdate: true }));
  if (!createParsed.success) {
    return createParsed;
  }
  return updateLotSchema.safeParse(createParsed.data);
}
