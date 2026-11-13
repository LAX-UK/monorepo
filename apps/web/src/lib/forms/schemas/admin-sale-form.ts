import type { BuyerPremiumTier, Sale } from "@auction/types";
import { saleDeliveryModes } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  STANDARD_BUYER_PREMIUM_BANDS,
  buyerPremiumTiersSchema,
  createSaleSchema,
  isAllowedStreamUrl,
  isSaleroomDeliveryMode,
  isStartInFutureForPublish,
  isUkPostcode,
  majorToMinor,
  mediaReferenceSchema,
  normalizeUkPostcode,
  saleTimeZoneMessage,
  saleTimeZoneProblem,
  sameBuyerPremiumSchedule,
  standardBuyerPremiumBands,
  updateSaleSchema,
} from "@auction/validators";
import { z } from "zod";
import { optionalBuyerPremiumRateSchema } from "./buyer-premium-rate";
import { readingZone } from "./reading-zone";
import { missingWallTimeMessage } from "./wall-time-in-zone";

function parseCategoryId(cat: string): string | undefined {
  const t = cat.trim();
  if (!t || !/^[0-9a-f-]{36}$/i.test(t)) return undefined;
  return t;
}

/** One tier row in the admin sale form (hammer in major currency units, e.g. 500000 for £500k). */
export const adminSaleTierRowSchema = z.object({
  hammerThresholdMajor: z.string().max(32),
  /** Empty rows are ignored; a filled one is a rate like the flat rate. */
  rate: optionalBuyerPremiumRateSchema,
});

/**
 * How the sale charges its buyer's premium: the published standard (15% up to £500,000, 10%
 * above), one flat rate, or staff-defined bands.
 */
export const saleBuyerPremiumModes = ["standard", "flat", "bands"] as const;
export type SaleBuyerPremiumMode = (typeof saleBuyerPremiumModes)[number];

export const adminSaleFormValuesSchema = z
  .object({
    title: z.string().min(1, "Enter a title").max(500),
    description: z.string().max(10_000),
    coverImages: z.array(mediaReferenceSchema).max(20),
    categoryId: z.string(),
    /** Test sale: hidden from the public and never announced. Draft sales only. */
    isTest: z.boolean(),
    deliveryMode: z.enum(saleDeliveryModes),
    /** UI-only: true = gated (allowOnlineBidsBeforeGoLive false). Hybrid sales only. */
    requireSaleroomGoLiveBeforeOnlineBids: z.boolean(),
    streamUrl: z.string().max(500),
    heroPresentation: z.enum(["cover", "video"]),
    heroVideoUrl: z.string().max(500),
    locationName: z.string().max(500),
    locationAddress: z.string().max(500),
    locationMapUrl: z.string().max(2048),
    locationAddressLine1: z.string().max(500),
    locationAddressLine2: z.string().max(500),
    locationCity: z.string().max(500),
    locationCounty: z.string().max(500),
    locationPostcode: z.string().max(16),
    locationCountry: z.string().max(120),
    venueId: z.string(),
    /** IANA zone the sale quotes its times in; the typed times below are read in it. */
    timeZone: z.string().min(1, "Choose a time zone"),
    startTime: z.string().min(1, "Start is required"),
    endTime: z.string().min(1, "End is required"),
    previewStartTime: z.string(),
    buyerPremiumMode: z.enum(saleBuyerPremiumModes),
    /** The flat rate, read when the mode is `flat`. */
    buyerPremiumRate: optionalBuyerPremiumRateSchema,
    /** Band rows, read when the mode is `bands`. */
    buyerPremiumTiers: z.array(adminSaleTierRowSchema).max(16),
    terms: z.string().max(50_000),
  })
  .superRefine((values, ctx) => {
    const zoneProblem = values.timeZone ? saleTimeZoneProblem(values.timeZone) : null;
    if (zoneProblem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: saleTimeZoneMessage(zoneProblem),
        path: ["timeZone"],
      });
    }
    const zone = readingZone(values.timeZone);
    for (const name of ["startTime", "endTime", "previewStartTime"] as const) {
      const message = missingWallTimeMessage(values[name], zone);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [name] });
    }
    const start = instantFromDatetimeFormString(values.startTime, zone);
    const end = instantFromDatetimeFormString(values.endTime, zone);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End must be after start",
        path: ["endTime"],
      });
    }
    const previewRaw = values.previewStartTime.trim();
    if (previewRaw) {
      const preview = instantFromDatetimeFormString(previewRaw, zone);
      if (Number.isNaN(preview.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid preview start",
          path: ["previewStartTime"],
        });
      } else if (!Number.isNaN(start.getTime()) && preview >= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Preview must be before sale start",
          path: ["previewStartTime"],
        });
      }
    }
    const stream = values.streamUrl.trim();
    if (isSaleroomDeliveryMode(values.deliveryMode) && stream && !isAllowedStreamUrl(stream)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unsupported stream URL host",
        path: ["streamUrl"],
      });
    }
    const heroVideo = values.heroVideoUrl.trim();
    if (heroVideo && !isAllowedStreamUrl(heroVideo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unsupported video URL host",
        path: ["heroVideoUrl"],
      });
    }
    if (values.heroPresentation === "video" && !heroVideo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hero video URL is required when homepage hero is set to video",
        path: ["heroVideoUrl"],
      });
    }
    if (values.buyerPremiumMode === "flat" && !values.buyerPremiumRate.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the flat rate",
        path: ["buyerPremiumRate"],
      });
    }
    if (
      values.buyerPremiumMode === "bands" &&
      values.buyerPremiumTiers.every((row) => !row.rate.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one band",
        path: ["buyerPremiumTiers"],
      });
    }
    if (values.buyerPremiumMode === "bands") {
      // A half-filled band is never dropped silently on save: each says what it still needs.
      values.buyerPremiumTiers.forEach((row, index) => {
        const message = buyerPremiumBandProblem(row, index);
        if (message) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: ["buyerPremiumTiers", index],
          });
        }
      });
    }
    if (isSaleroomDeliveryMode(values.deliveryMode)) {
      const postcode = values.locationPostcode.trim();
      if (postcode) {
        const normalized = normalizeUkPostcode(postcode);
        if (!isUkPostcode(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid UK postcode (e.g. SW1Y 6QU)",
            path: ["locationPostcode"],
          });
        }
      }
    }
  });

/** Draft sales require a future opening time; published sale edits omit this rule. */
export function adminSaleDraftScheduleSchema() {
  return adminSaleFormValuesSchema.superRefine((values, ctx) => {
    const start = instantFromDatetimeFormString(values.startTime, readingZone(values.timeZone));
    if (!Number.isNaN(start.getTime()) && !isStartInFutureForPublish(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Opening time must be in the future",
        path: ["startTime"],
      });
    }
  });
}

export type AdminSaleTierRow = z.infer<typeof adminSaleTierRowSchema>;

/**
 * What a custom band row still needs, or `null` when it is complete: "Band 2 needs a rate and a
 * starting hammer". Band 1 always starts at £0, so it only ever needs its rate.
 */
export function buyerPremiumBandProblem(
  row: Pick<AdminSaleTierRow, "hammerThresholdMajor" | "rate">,
  index: number,
): string | null {
  const hasRate = row.rate.trim() !== "";
  const hasStart = index === 0 || row.hammerThresholdMajor.trim() !== "";
  if (hasRate && hasStart) return null;
  const band = `Band ${index + 1}`;
  if (!hasRate && !hasStart) return `${band} needs a rate and a starting hammer`;
  return hasRate ? `${band} needs a starting hammer` : `${band} needs a rate`;
}

export type AdminSaleFormValues = z.infer<typeof adminSaleFormValuesSchema>;

/**
 * Map tier rows from the admin form to API `BuyerPremiumTier[]` or `null` when no bands.
 * Rows with an empty `rate` are ignored. First row always uses threshold £0 (band floor).
 */
export function normalizeAdminFormTiersToApi(
  rows: AdminSaleFormValues["buyerPremiumTiers"],
): { ok: true; data: BuyerPremiumTier[] | null } | { ok: false; error: z.ZodError } {
  const filtered = rows.filter((r) => r.rate.trim() !== "");
  if (filtered.length === 0) {
    return { ok: true, data: null };
  }
  const mapped: BuyerPremiumTier[] = filtered.map((r, index) => {
    const majorRaw = index === 0 ? "0" : r.hammerThresholdMajor.trim() || "0";
    return {
      hammerThresholdMinor: majorToMinor(majorRaw),
      rate: r.rate.trim(),
    };
  });
  const parsed = buyerPremiumTiersSchema.safeParse(mapped);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, data: parsed.data };
}

/** The mode a saved sale's premium is in: bands equal to the standard read as the standard. */
export function saleBuyerPremiumModeOf(
  sale: Pick<Sale, "buyerPremiumTiers">,
): SaleBuyerPremiumMode {
  const tiers = sale.buyerPremiumTiers;
  if (!tiers || tiers.length === 0) return "flat";
  return sameBuyerPremiumSchedule(
    { kind: "bands", bands: tiers },
    { kind: "bands", bands: STANDARD_BUYER_PREMIUM_BANDS },
  )
    ? "standard"
    : "bands";
}

/** The standard bands as form rows, a starting point for custom bands. */
export function standardBuyerPremiumTierRows(): AdminSaleFormValues["buyerPremiumTiers"] {
  return STANDARD_BUYER_PREMIUM_BANDS.map((band) => ({
    hammerThresholdMajor: String(band.hammerThresholdMinor / 100),
    rate: band.rate,
  }));
}

/**
 * The premium the API stores for the chosen mode: the standard bands, the flat rate (no bands),
 * or the staff's bands. `null` when the band rows do not parse.
 */
export function buyerPremiumPayloadFromForm(
  values: Pick<AdminSaleFormValues, "buyerPremiumMode" | "buyerPremiumRate" | "buyerPremiumTiers">,
):
  | { ok: true; data: { buyerPremiumRate?: string; buyerPremiumTiers: BuyerPremiumTier[] | null } }
  | { ok: false; error: z.ZodError } {
  if (values.buyerPremiumMode === "standard") {
    return { ok: true, data: { buyerPremiumTiers: standardBuyerPremiumBands() } };
  }
  if (values.buyerPremiumMode === "flat") {
    const rate = values.buyerPremiumRate.trim();
    return {
      ok: true,
      data: { ...(rate ? { buyerPremiumRate: rate } : {}), buyerPremiumTiers: null },
    };
  }
  const tiers = normalizeAdminFormTiersToApi(values.buyerPremiumTiers);
  return tiers.ok ? { ok: true, data: { buyerPremiumTiers: tiers.data } } : tiers;
}

type LocationFormFieldKey =
  | "locationName"
  | "locationAddress"
  | "locationMapUrl"
  | "locationAddressLine1"
  | "locationAddressLine2"
  | "locationCity"
  | "locationCounty"
  | "locationPostcode"
  | "locationCountry";

const LOCATION_FORM_KEYS: readonly LocationFormFieldKey[] = [
  "locationName",
  "locationAddress",
  "locationMapUrl",
  "locationAddressLine1",
  "locationAddressLine2",
  "locationCity",
  "locationCounty",
  "locationPostcode",
  "locationCountry",
];

function pickLocationCreate(
  values: AdminSaleFormValues,
  isOnsite: boolean,
): Partial<Record<LocationFormFieldKey, string | undefined>> {
  const out: Partial<Record<LocationFormFieldKey, string | undefined>> = {};
  for (const k of LOCATION_FORM_KEYS) {
    out[k] = isOnsite ? values[k].trim() || undefined : undefined;
  }
  return out;
}

function pickLocationUpdate(
  values: AdminSaleFormValues,
  isOnsite: boolean,
): Partial<Record<LocationFormFieldKey, string | null>> {
  const out: Partial<Record<LocationFormFieldKey, string | null>> = {};
  for (const k of LOCATION_FORM_KEYS) {
    if (!isOnsite) {
      out[k] = null;
      continue;
    }
    const trimmed = values[k].trim();
    out[k] = trimmed === "" ? null : trimmed;
  }
  return out;
}

/** @internal Shared by create/update sale form parsers. */
export const buildSaleLocationCreatePayload = pickLocationCreate;
/** @internal Shared by create/update sale form parsers. */
export const buildSaleLocationUpdatePayload = pickLocationUpdate;

function pickHeroFields(values: AdminSaleFormValues): {
  heroPresentation: AdminSaleFormValues["heroPresentation"];
  heroVideoUrl: string | null;
} {
  const heroVideoRaw = values.heroVideoUrl.trim();
  if (values.heroPresentation === "video") {
    return {
      heroPresentation: "video",
      heroVideoUrl: heroVideoRaw === "" ? null : heroVideoRaw,
    };
  }
  return { heroPresentation: "cover", heroVideoUrl: null };
}

export function safeParseCreateSaleFromForm(values: AdminSaleFormValues) {
  const premium = buyerPremiumPayloadFromForm(values);
  if (!premium.ok) {
    return { success: false as const, error: premium.error };
  }
  const isSaleroom = isSaleroomDeliveryMode(values.deliveryMode);
  const zone = readingZone(values.timeZone);
  return createSaleSchema.safeParse({
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    coverImages: values.coverImages.length > 0 ? values.coverImages : undefined,
    categoryId: parseCategoryId(values.categoryId),
    ...(values.isTest ? { isTest: true } : {}),
    deliveryMode: values.deliveryMode,
    ...(values.deliveryMode === "hybrid"
      ? { allowOnlineBidsBeforeGoLive: !values.requireSaleroomGoLiveBeforeOnlineBids }
      : {}),
    streamUrl: isSaleroom ? values.streamUrl.trim() || undefined : undefined,
    ...pickHeroFields(values),
    venueId: isSaleroom ? values.venueId.trim() || undefined : undefined,
    ...pickLocationCreate(values, isSaleroom),
    timeZone: values.timeZone,
    startTime: instantFromDatetimeFormString(values.startTime, zone),
    endTime: instantFromDatetimeFormString(values.endTime, zone),
    previewStartTime: values.previewStartTime.trim()
      ? instantFromDatetimeFormString(values.previewStartTime, zone)
      : undefined,
    ...premium.data,
    terms: values.terms.trim() || undefined,
  });
}

/** Minimal patch for published sales (title, description, cover images, hero, stream URL on live sales). */
export function safeParseUpdatePublishedSaleFromForm(values: AdminSaleFormValues) {
  const streamRaw = values.streamUrl.trim();
  const isSaleroom = isSaleroomDeliveryMode(values.deliveryMode);
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: values.coverImages,
    ...pickHeroFields(values),
    ...(isSaleroom ? { streamUrl: streamRaw === "" ? null : streamRaw } : {}),
  });
}

export function safeParseUpdateSaleFromForm(values: AdminSaleFormValues) {
  const premium = buyerPremiumPayloadFromForm(values);
  if (!premium.ok) {
    return { success: false as const, error: premium.error };
  }
  const streamRaw = values.streamUrl.trim();
  const isSaleroom = isSaleroomDeliveryMode(values.deliveryMode);
  const zone = readingZone(values.timeZone);
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: values.coverImages,
    categoryId: parseCategoryId(values.categoryId),
    isTest: values.isTest,
    deliveryMode: values.deliveryMode,
    ...(values.deliveryMode === "hybrid"
      ? { allowOnlineBidsBeforeGoLive: !values.requireSaleroomGoLiveBeforeOnlineBids }
      : {}),
    streamUrl: isSaleroom ? (streamRaw === "" ? null : streamRaw) : null,
    ...pickHeroFields(values),
    venueId: isSaleroom ? values.venueId.trim() || null : null,
    ...pickLocationUpdate(values, isSaleroom),
    timeZone: values.timeZone,
    startTime: values.startTime.trim()
      ? instantFromDatetimeFormString(values.startTime, zone)
      : undefined,
    endTime: values.endTime.trim()
      ? instantFromDatetimeFormString(values.endTime, zone)
      : undefined,
    previewStartTime: values.previewStartTime.trim()
      ? instantFromDatetimeFormString(values.previewStartTime, zone)
      : undefined,
    ...premium.data,
    terms: values.terms.trim() || undefined,
  });
}
