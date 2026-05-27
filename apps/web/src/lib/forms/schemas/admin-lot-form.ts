import { lotAuctionTypes } from "@auction/types";
import type { SaleDeliveryMode } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  type CreateLotInput,
  createLotSchema,
  getSaleModeCapabilities,
  lotTimingViolationAgainstSale,
  mediaReferenceSchema,
  updateLotSchema,
} from "@auction/validators";
import type { z } from "zod";
import { z as zod } from "zod";

const decimalString = zod.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

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
        message: "Decrement amount is required for Dutch lots",
        path: ["dutchDecrementAmount"],
      });
    } else if (!decimalString.safeParse(amount).success) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Must be a valid decimal string",
        path: ["dutchDecrementAmount"],
      });
    }
    const intervalRaw = values.dutchDecrementIntervalMs?.trim() ?? "";
    if (!intervalRaw) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Decrement interval is required for Dutch lots",
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
        message: "Buy now price is required",
        path: ["buyNowPrice"],
      });
    } else if (!decimalString.safeParse(buyNow).success) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Must be a valid decimal string",
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

const buyerPremiumRateString = zod
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

const optionalDecimal = zod.union([decimalString, zod.literal("")]);
const optionalBuyerPremium = zod.union([buyerPremiumRateString, zod.literal("")]);

/** Aligned with admin create/edit lot pages (datetime-local strings). */
export const adminLotFormValuesSchema = zod
  .object({
    title: zod.string().min(1).max(500),
    description: optionalStr,
    medium: optionalStr,
    dimensions: optionalStr,
    /** Legal entity id — replaces legacy user-based sellerId. */
    sellerLegalEntityId: zod.string().uuid("Choose a seller legal entity"),
    /** Display label for the picker chip (not sent to API). */
    sellerDisplayName: zod.string().optional(),
    categoryIds: zod
      .array(zod.string().uuid())
      .min(1, "Choose at least one category")
      .max(8, "Choose no more than 8 categories"),
    saleId: zod.string().uuid("Choose a sale"),
    lotNumber: zod
      .union([zod.coerce.number().int().positive(), zod.literal("")])
      .nullable()
      .optional(),
    auctionType: zod.enum(lotAuctionTypes),
    startingPrice: decimalString,
    reservePrice: optionalDecimal,
    buyNowPrice: optionalDecimal,
    buyerPremiumRate: optionalBuyerPremium,
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
    startTime: zod.string().min(1, "Start time required"),
    endTime: zod.string().min(1, "End time required"),
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
    const start = instantFromDatetimeFormString(values.startTime);
    const end = instantFromDatetimeFormString(values.endTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "End must be after start",
        path: ["endTime"],
      });
    }
    refineLotFieldsByAuctionType(values, ctx);
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
