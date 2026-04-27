import { saleDeliveryModes, saleStatuses } from "@auction/types";
import type { SaleDeliveryMode } from "@auction/types";
import { z } from "zod";
import { createNestedLotForSaleSchema } from "./lot.js";
import { isUkPostcode, normalizeUkPostcode } from "./onsite-location.js";
import { getSaleModeCapabilities } from "./sale-mode-policy.js";
import { isAllowedStreamUrl } from "./stream-embed.js";

const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

const streamUrlField = z
  .union([z.string().url().max(500), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine((v) => v == null || isAllowedStreamUrl(v), {
    message: "Unsupported stream URL host",
  });

const locationTextField = z
  .union([z.string().min(1).max(500), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

const locationMapUrlField = z
  .union([z.string().url().max(2048), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

const locationPostcodeField = z
  .union([z.string().min(1).max(16), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === "" || v === undefined || v === null) return null;
    return normalizeUkPostcode(v);
  })
  .superRefine((v, ctx) => {
    if (v == null) return;
    if (!isUkPostcode(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid UK postcode (e.g. SW1Y 6QU)",
      });
    }
  });

const saleCreateBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  coverImages: z.array(z.string().url()).max(20).optional(),
  categoryId: z.string().uuid().optional(),
  deliveryMode: z.enum(saleDeliveryModes).optional(),
  streamUrl: streamUrlField,
  locationName: locationTextField,
  locationAddress: locationTextField,
  locationMapUrl: locationMapUrlField,
  locationAddressLine1: locationTextField,
  locationAddressLine2: locationTextField,
  locationCity: locationTextField,
  locationCounty: locationTextField,
  locationPostcode: locationPostcodeField,
  locationCountry: locationTextField,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  previewStartTime: z.coerce.date().optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  terms: z.string().max(50_000).optional(),
  lots: z.array(createNestedLotForSaleSchema).max(500).optional(),
});

type LocationFieldKey =
  | "locationName"
  | "locationAddress"
  | "locationMapUrl"
  | "locationAddressLine1"
  | "locationAddressLine2"
  | "locationCity"
  | "locationCounty"
  | "locationPostcode"
  | "locationCountry";

const LOCATION_FIELD_KEYS: readonly LocationFieldKey[] = [
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

function refineByMode(
  data: {
    deliveryMode?: SaleDeliveryMode | undefined;
    streamUrl?: string | null | undefined;
  } & Partial<Record<LocationFieldKey, string | null | undefined>>,
  ctx: z.RefinementCtx,
  defaultMode: SaleDeliveryMode,
): void {
  const mode = data.deliveryMode ?? defaultMode;
  const caps = getSaleModeCapabilities(mode);
  if (!caps.allowsStreamUrl && data.streamUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Stream URL is only allowed for onsite auctions",
      path: ["streamUrl"],
    });
  }
  if (!caps.allowsLocation) {
    for (const key of LOCATION_FIELD_KEYS) {
      if (data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Location is only allowed for onsite auctions",
          path: [key],
        });
      }
    }
  }
}

export const createSaleSchema = saleCreateBodySchema.superRefine((data, ctx) => {
  refineByMode(data, ctx, "onsite");
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleSchema = saleCreateBodySchema
  .partial()
  .omit({ lots: true })
  .superRefine((data, ctx) => {
    refineByMode(data, ctx, "onsite");
  });

export const listSalesQuerySchema = z.object({
  status: z.enum(saleStatuses).optional(),
  statuses: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean) as (typeof saleStatuses)[number][];
    })
    .refine((arr) => arr == null || arr.every((x) => saleStatuses.includes(x)), {
      message: "Invalid sale status in statuses",
    }),
  categoryId: z.string().uuid().optional(),
  sort: z.enum(["createdDesc", "startAsc"]).optional().default("createdDesc"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const saleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const cancelSaleBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const markSaleEndedBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updateSaleStatusBodySchema = z.object({
  status: z.enum(["scheduled", "active", "ended", "cancelled"]),
  reason: z.string().max(500).optional(),
});

export const updateLotStatusBodySchema = z.object({
  status: z.enum(["draft", "scheduled", "active", "ended", "cancelled"]),
  reason: z.string().max(500).optional(),
});

export const saleLotIdParamSchema = z.object({
  id: z.string().uuid(),
  lotId: z.string().uuid(),
});

/** Saleroom paginated lots — matches API `ListLotsSort` mapping. */
export const listSaleLotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional().default(40),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort: z.enum(["lot", "priceAsc", "priceDesc", "endingAsc"]).optional().default("lot"),
});

export type ListSaleLotsQuery = z.infer<typeof listSaleLotsQuerySchema>;

export const listSaleBiddersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListSaleBiddersQuery = z.infer<typeof listSaleBiddersQuerySchema>;
