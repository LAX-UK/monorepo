import { saleDeliveryModes } from "@auction/types";
import { createSaleSchema, updateSaleSchema } from "@auction/validators";
import { z } from "zod";

function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCategoryId(cat: string): string | undefined {
  const t = cat.trim();
  if (!t || !/^[0-9a-f-]{36}$/i.test(t)) return undefined;
  return t;
}

export const adminSaleFormValuesSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10_000),
  coverImages: z.string(),
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
  buyerPremiumRate: z.string(),
  terms: z.string().max(50_000),
});

export type AdminSaleFormValues = z.infer<typeof adminSaleFormValuesSchema>;

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

export function safeParseCreateSaleFromForm(values: AdminSaleFormValues) {
  const coverRaw = values.coverImages.trim();
  const isOnsite = values.deliveryMode === "onsite";
  return createSaleSchema.safeParse({
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: isOnsite ? values.streamUrl.trim() || undefined : undefined,
    ...pickLocationCreate(values, isOnsite),
    startTime: new Date(values.startTime),
    endTime: new Date(values.endTime),
    previewStartTime: values.previewStartTime.trim()
      ? new Date(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    terms: values.terms.trim() || undefined,
  });
}

export function safeParseUpdateSaleFromForm(values: AdminSaleFormValues) {
  const coverRaw = values.coverImages.trim();
  const streamRaw = values.streamUrl.trim();
  const isOnsite = values.deliveryMode === "onsite";
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: isOnsite ? (streamRaw === "" ? null : streamRaw) : null,
    ...pickLocationUpdate(values, isOnsite),
    startTime: values.startTime.trim() ? new Date(values.startTime) : undefined,
    endTime: values.endTime.trim() ? new Date(values.endTime) : undefined,
    previewStartTime: values.previewStartTime.trim()
      ? new Date(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    terms: values.terms.trim() || undefined,
  });
}
