import type { BuyerPremiumTier } from "@auction/types";
import { saleDeliveryModes } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  buyerPremiumTiersSchema,
  createSaleSchema,
  isAllowedStreamUrl,
  isStartInFutureForPublish,
  isUkPostcode,
  majorToMinor,
  mediaReferenceSchema,
  normalizeUkPostcode,
  updateSaleSchema,
} from "@auction/validators";
import { z } from "zod";

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

const optionalBuyerPremiumRate = z.union([buyerPremiumRateString, z.literal("")]);

function parseCategoryId(cat: string): string | undefined {
  const t = cat.trim();
  if (!t || !/^[0-9a-f-]{36}$/i.test(t)) return undefined;
  return t;
}

/** One tier row in the admin sale form (hammer in major currency units, e.g. 500000 for £500k). */
export const adminSaleTierRowSchema = z.object({
  hammerThresholdMajor: z.string().max(32),
  rate: z.string().max(16),
});

export const adminSaleFormValuesSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().max(10_000),
    coverImages: z.array(mediaReferenceSchema).max(20),
    categoryId: z.string(),
    deliveryMode: z.enum(saleDeliveryModes),
    streamUrl: z.string().max(500),
    locationName: z.string().max(500),
    locationAddress: z.string().max(500),
    locationMapUrl: z.string().max(2048),
    locationAddressLine1: z.string().max(500),
    locationAddressLine2: z.string().max(500),
    locationCity: z.string().max(500),
    locationCounty: z.string().max(500),
    locationPostcode: z.string().max(16),
    locationCountry: z.string().max(120),
    startTime: z.string().min(1, "Start is required"),
    endTime: z.string().min(1, "End is required"),
    previewStartTime: z.string(),
    buyerPremiumRate: optionalBuyerPremiumRate,
    /** Band rows; empty = flat rate only (`buyerPremiumRate`). */
    buyerPremiumTiers: z.array(adminSaleTierRowSchema).max(16),
    terms: z.string().max(50_000),
  })
  .superRefine((values, ctx) => {
    const start = instantFromDatetimeFormString(values.startTime);
    const end = instantFromDatetimeFormString(values.endTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End must be after start",
        path: ["endTime"],
      });
    }
    const previewRaw = values.previewStartTime.trim();
    if (previewRaw) {
      const preview = instantFromDatetimeFormString(previewRaw);
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
    if (stream && !isAllowedStreamUrl(stream)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unsupported stream URL host",
        path: ["streamUrl"],
      });
    }
    if (values.deliveryMode === "onsite") {
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
    const start = instantFromDatetimeFormString(values.startTime);
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

export function safeParseCreateSaleFromForm(values: AdminSaleFormValues) {
  const tiers = normalizeAdminFormTiersToApi(values.buyerPremiumTiers);
  if (!tiers.ok) {
    return { success: false as const, error: tiers.error };
  }
  const isOnsite = values.deliveryMode === "onsite";
  return createSaleSchema.safeParse({
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    coverImages: values.coverImages.length > 0 ? values.coverImages : undefined,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: isOnsite ? values.streamUrl.trim() || undefined : undefined,
    ...pickLocationCreate(values, isOnsite),
    startTime: instantFromDatetimeFormString(values.startTime),
    endTime: instantFromDatetimeFormString(values.endTime),
    previewStartTime: values.previewStartTime.trim()
      ? instantFromDatetimeFormString(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    ...(tiers.data !== null ? { buyerPremiumTiers: tiers.data } : {}),
    terms: values.terms.trim() || undefined,
  });
}

/** Minimal patch for published sales (title, description, cover images only). */
export function safeParseUpdatePublishedSaleFromForm(values: AdminSaleFormValues) {
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: values.coverImages,
  });
}

export function safeParseUpdateSaleFromForm(values: AdminSaleFormValues) {
  const tiers = normalizeAdminFormTiersToApi(values.buyerPremiumTiers);
  if (!tiers.ok) {
    return { success: false as const, error: tiers.error };
  }
  const streamRaw = values.streamUrl.trim();
  const isOnsite = values.deliveryMode === "onsite";
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: values.coverImages,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: isOnsite ? (streamRaw === "" ? null : streamRaw) : null,
    ...pickLocationUpdate(values, isOnsite),
    startTime: values.startTime.trim()
      ? instantFromDatetimeFormString(values.startTime)
      : undefined,
    endTime: values.endTime.trim() ? instantFromDatetimeFormString(values.endTime) : undefined,
    previewStartTime: values.previewStartTime.trim()
      ? instantFromDatetimeFormString(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    buyerPremiumTiers: tiers.data,
    terms: values.terms.trim() || undefined,
  });
}
