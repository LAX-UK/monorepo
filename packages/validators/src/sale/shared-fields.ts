import { saleDeliveryModes } from "@auction/types";
import type { SaleDeliveryMode } from "@auction/types";
import { z } from "zod";
import { buyerPremiumTiersSchema } from "../buyer-premium.js";
import { createNestedLotForSaleSchema } from "../lot/create-update.js";
import { mediaReferenceSchema } from "../media.js";
import { isUkPostcode, normalizeUkPostcode } from "../onsite-location.js";
import { getSaleModeCapabilities } from "../sale-mode-policy.js";
import { isAllowedStreamUrl } from "../stream-embed.js";

export const buyerPremiumRateString = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Must be a decimal between 0 and 1")
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, "Buyer premium rate must be between 0 and 1");

export const optionalCategoryIdsSchema = z.array(z.string().uuid()).max(8).optional();

export function normalizeOptionalCategoryIdsInput(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.categoryIds)) return raw;
  if (typeof record.categoryId === "string" && record.categoryId.length > 0) {
    return { ...record, categoryIds: [record.categoryId] };
  }
  return raw;
}

export const streamUrlField = z
  .union([z.string().url().max(500), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine((v) => v == null || isAllowedStreamUrl(v), {
    message: "Unsupported stream URL host",
  });

export const locationTextField = z
  .union([z.string().min(1).max(500), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const locationMapUrlField = z
  .union([z.string().url().max(2048), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const locationPostcodeField = z
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

const pressMentionTypes = ["feature", "interview", "quote", "roundup"] as const;

export const salePressRefSchema = z
  .object({
    url: z
      .string()
      .url()
      .max(2048)
      .refine(
        (v) => {
          try {
            const { protocol } = new URL(v);
            return protocol === "https:" || protocol === "http:";
          } catch {
            return false;
          }
        },
        { message: "Press URL must start with https:// or http://" },
      ),
    headline: z.string().min(1).max(500),
    outletName: z.string().min(1).max(200),
    publishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "publishedAt must be YYYY-MM-DD")
      .refine(
        (v) => {
          const d = new Date(`${v}T12:00:00Z`);
          return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
        },
        { message: "publishedAt must be a valid calendar date (YYYY-MM-DD)" },
      )
      .optional(),
    excerpt: z.string().max(280).optional(),
    mentionType: z.enum(pressMentionTypes).optional(),
    imageUrl: z
      .string()
      .max(2048)
      .refine(
        (v) => {
          try {
            const { protocol } = new URL(v);
            return protocol === "https:" || protocol === "http:";
          } catch {
            return false;
          }
        },
        { message: "imageUrl must start with https:// or http://" },
      )
      .optional(),
  })
  .transform((v) => {
    const out: {
      url: string;
      headline: string;
      outletName: string;
      publishedAt?: string;
      excerpt?: string;
      mentionType?: (typeof pressMentionTypes)[number];
      imageUrl?: string;
    } = { url: v.url, headline: v.headline, outletName: v.outletName };
    if (v.publishedAt) out.publishedAt = v.publishedAt;
    if (v.excerpt) out.excerpt = v.excerpt;
    if (v.mentionType) out.mentionType = v.mentionType;
    if (v.imageUrl) out.imageUrl = v.imageUrl;
    return out;
  });

export const dayPhotoRefSchema = z
  .object({
    mediaType: z.enum(["image", "video"]).optional(),
    key: mediaReferenceSchema,
    caption: z.string().max(280).optional(),
    alt: z.string().max(280).optional(),
    posterKey: mediaReferenceSchema.optional(),
  })
  .transform((v) => {
    const isVideo = v.mediaType === "video";
    if (isVideo) {
      const out: { mediaType: "video"; key: string; caption?: string; posterKey?: string } = {
        mediaType: "video",
        key: v.key,
      };
      if (v.caption) out.caption = v.caption;
      if (v.posterKey) out.posterKey = v.posterKey;
      return out;
    }
    const out: { mediaType?: "image"; key: string; caption?: string; alt?: string } = {
      key: v.key,
    };
    if (v.mediaType) out.mediaType = "image";
    if (v.caption) out.caption = v.caption;
    if (v.alt) out.alt = v.alt;
    return out;
  });

export const saleCreateBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  coverImages: z.array(mediaReferenceSchema).max(20).optional(),
  /** Auction-day event photos. Accepted on update only for ended onsite/hybrid sales. */
  dayImages: z.array(dayPhotoRefSchema).max(60).optional(),
  /** Curated press/news links. Accepted for all sale statuses and delivery modes. */
  pressCoverage: z.array(salePressRefSchema).max(50).optional(),
  categoryIds: optionalCategoryIdsSchema,
  categoryId: z.string().uuid().optional(),
  deliveryMode: z.enum(saleDeliveryModes).optional(),
  allowOnlineBidsBeforeGoLive: z.coerce.boolean().optional(),
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
  venueId: z.string().uuid().optional().nullable(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  previewStartTime: z.coerce.date().optional(),
  buyerPremiumRate: buyerPremiumRateString.optional(),
  /** Optional band-based premium tier override; see `buyer-premium.ts`. */
  buyerPremiumTiers: buyerPremiumTiersSchema.nullable().optional(),
  terms: z.string().max(50_000).optional(),
  lots: z.array(createNestedLotForSaleSchema).max(500).optional(),
});

export type LocationFieldKey =
  | "locationName"
  | "locationAddress"
  | "locationMapUrl"
  | "locationAddressLine1"
  | "locationAddressLine2"
  | "locationCity"
  | "locationCounty"
  | "locationPostcode"
  | "locationCountry";

export const LOCATION_FIELD_KEYS: readonly LocationFieldKey[] = [
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

export function refineByMode(
  data: {
    deliveryMode?: SaleDeliveryMode | undefined;
    streamUrl?: string | null | undefined;
    venueId?: string | null | undefined;
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
    if (data.venueId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Venue is only allowed for onsite auctions",
        path: ["venueId"],
      });
    }
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

function refinePreviewStartTime(
  data: { previewStartTime?: Date | undefined; startTime?: Date | undefined },
  ctx: z.RefinementCtx,
): void {
  if (
    data.previewStartTime &&
    data.startTime &&
    data.previewStartTime.getTime() >= data.startTime.getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Preview must be before sale start",
      path: ["previewStartTime"],
    });
  }
}

export function refineSaleCreateBody(
  data: z.infer<typeof saleCreateBodySchema>,
  ctx: z.RefinementCtx,
) {
  refineByMode(data, ctx, "onsite");
  refinePreviewStartTime(data, ctx);
}

export function refineSaleUpdateBody(data: Record<string, unknown>, ctx: z.RefinementCtx) {
  refineByMode(data as Parameters<typeof refineByMode>[0], ctx, "onsite");
  refinePreviewStartTime(data as Parameters<typeof refinePreviewStartTime>[0], ctx);
}
