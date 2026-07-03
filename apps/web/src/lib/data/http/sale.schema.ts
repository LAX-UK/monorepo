import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zStringArrayFromUnknown } from "@/lib/data/http/schema-coerce";
import type {
  BuyerPremiumTier,
  GalleryImage,
  Sale,
  SaleDayMedia,
  SaleDayMediaRef,
  SalePressMentionType,
  SalePressRef,
} from "@auction/types";
import { z } from "zod";

function parseSaleDeliveryMode(raw: unknown): Sale["deliveryMode"] {
  const value = typeof raw === "string" ? raw : "";
  if (value === "online" || value === "onsite" || value === "hybrid") return value;
  return "onsite";
}

function parseBuyerPremiumTiers(raw: unknown): BuyerPremiumTier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: BuyerPremiumTier[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    const threshold =
      typeof entry.hammerThresholdMinor === "number"
        ? entry.hammerThresholdMinor
        : Number.parseInt(String(entry.hammerThresholdMinor ?? ""), 10);
    const rate = String(entry.rate ?? "");
    if (!Number.isFinite(threshold) || threshold < 0) continue;
    if (!/^\d(\.\d{1,4})?$/.test(rate)) continue;
    out.push({ hammerThresholdMinor: threshold, rate });
  }
  return out.length > 0 ? out : null;
}

function parseGalleryImages(raw: unknown): GalleryImage[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: GalleryImage[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    const src =
      typeof entry.src === "string" ? entry.src : typeof entry.url === "string" ? entry.url : null;
    if (!src) continue;
    const image: GalleryImage = { src };
    if (typeof entry.alt === "string" && entry.alt.trim()) image.alt = entry.alt.trim();
    if (typeof entry.width === "number") image.width = entry.width;
    if (typeof entry.height === "number") image.height = entry.height;
    if (typeof entry.blurDataURL === "string" && entry.blurDataURL)
      image.blurDataURL = entry.blurDataURL;
    out.push(image);
  }
  return out.length > 0 ? out : undefined;
}

function parsePressRefs(raw: unknown): SalePressRef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SalePressRef[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    const url = typeof entry.url === "string" ? entry.url.trim() : null;
    const headline = typeof entry.headline === "string" ? entry.headline.trim() : null;
    const outletName = typeof entry.outletName === "string" ? entry.outletName.trim() : null;
    if (!url || !headline || !outletName) continue;
    const ref: SalePressRef = { url, headline, outletName };
    if (typeof entry.publishedAt === "string" && entry.publishedAt.trim()) {
      ref.publishedAt = entry.publishedAt.trim();
    }
    if (typeof entry.excerpt === "string" && entry.excerpt.trim()) {
      ref.excerpt = entry.excerpt.trim();
    }
    if (
      typeof entry.mentionType === "string" &&
      ["feature", "interview", "quote", "roundup"].includes(entry.mentionType)
    ) {
      ref.mentionType = entry.mentionType as SalePressMentionType;
    }
    if (typeof entry.imageUrl === "string" && entry.imageUrl.trim()) {
      ref.imageUrl = entry.imageUrl.trim();
    }
    out.push(ref);
  }
  return out.length > 0 ? out : undefined;
}

function parseDayPhotoRefs(raw: unknown): SaleDayMediaRef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SaleDayMediaRef[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    const key = typeof entry.key === "string" ? entry.key.trim() : null;
    if (!key) continue;
    if (entry.mediaType === "video") {
      const ref: import("@auction/types").SaleDayVideoRef = { mediaType: "video", key };
      if (typeof entry.caption === "string" && entry.caption.trim())
        ref.caption = entry.caption.trim();
      if (typeof entry.posterKey === "string" && entry.posterKey.trim()) {
        ref.posterKey = entry.posterKey.trim();
      }
      out.push(ref);
    } else {
      const ref: import("@auction/types").SaleDayPhotoRef = { key };
      if (entry.mediaType === "image") ref.mediaType = "image";
      if (typeof entry.caption === "string" && entry.caption.trim())
        ref.caption = entry.caption.trim();
      if (typeof entry.alt === "string" && entry.alt.trim()) ref.alt = entry.alt.trim();
      out.push(ref);
    }
  }
  return out.length > 0 ? out : undefined;
}

function parseDayPhotoAssets(raw: unknown): SaleDayMedia[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SaleDayMedia[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    if (entry.mediaType === "video") {
      const src =
        typeof entry.src === "string"
          ? entry.src.trim()
          : typeof entry.key === "string"
            ? entry.key.trim()
            : null;
      if (!src) continue;
      const video: import("@auction/types").SaleDayVideo = { mediaType: "video", src };
      if (typeof entry.posterSrc === "string" && entry.posterSrc) video.posterSrc = entry.posterSrc;
      if (typeof entry.caption === "string" && entry.caption.trim())
        video.caption = entry.caption.trim();
      if (typeof entry.width === "number") video.width = entry.width;
      if (typeof entry.height === "number") video.height = entry.height;
      out.push(video);
    } else {
      const src =
        typeof entry.src === "string"
          ? entry.src.trim()
          : typeof entry.url === "string"
            ? entry.url.trim()
            : typeof entry.key === "string"
              ? entry.key.trim()
              : null;
      if (!src) continue;
      const photo: import("@auction/types").SaleDayPhoto = { mediaType: "image", src };
      if (typeof entry.alt === "string" && entry.alt.trim()) photo.alt = entry.alt.trim();
      if (typeof entry.width === "number") photo.width = entry.width;
      if (typeof entry.height === "number") photo.height = entry.height;
      if (typeof entry.blurDataURL === "string" && entry.blurDataURL) {
        photo.blurDataURL = entry.blurDataURL;
      }
      if (typeof entry.caption === "string" && entry.caption.trim())
        photo.caption = entry.caption.trim();
      out.push(photo);
    }
  }
  return out.length > 0 ? out : undefined;
}

function nullableString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

const saleRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform((row): Sale => {
  const coverImageAssets = parseGalleryImages(row.coverImageAssets);
  const dayImages = parseDayPhotoRefs(row.dayImages);
  const dayImageAssets = parseDayPhotoAssets(row.dayImageAssets);
  const pressCoverage = parsePressRefs(row.pressCoverage);

  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    coverImages: zStringArrayFromUnknown.parse(row.coverImages),
    ...(coverImageAssets !== undefined ? { coverImageAssets } : {}),
    ...(dayImages !== undefined ? { dayImages } : {}),
    ...(dayImageAssets !== undefined ? { dayImageAssets } : {}),
    ...(pressCoverage !== undefined ? { pressCoverage } : {}),
    categoryId: row.categoryId == null || row.categoryId === "" ? null : String(row.categoryId),
    categoryIds: zStringArrayFromUnknown.parse(row.categoryIds),
    deliveryMode: parseSaleDeliveryMode(row.deliveryMode),
    allowOnlineBidsBeforeGoLive: row.allowOnlineBidsBeforeGoLive === true,
    streamUrl: nullableString(row.streamUrl),
    locationName: nullableString(row.locationName),
    locationAddress: nullableString(row.locationAddress),
    locationMapUrl: nullableString(row.locationMapUrl),
    locationAddressLine1: nullableString(row.locationAddressLine1),
    locationAddressLine2: nullableString(row.locationAddressLine2),
    locationCity: nullableString(row.locationCity),
    locationCounty: nullableString(row.locationCounty),
    locationPostcode: nullableString(row.locationPostcode),
    locationCountry: nullableString(row.locationCountry),
    status: row.status as Sale["status"],
    startTime: zCoerceDate.parse(row.startTime),
    endTime: zCoerceDate.parse(row.endTime),
    previewStartTime:
      row.previewStartTime == null || row.previewStartTime === ""
        ? null
        : zCoerceDate.parse(row.previewStartTime),
    buyerPremiumRate:
      row.buyerPremiumRate == null || row.buyerPremiumRate === ""
        ? "0.25"
        : String(row.buyerPremiumRate),
    buyerPremiumTiers: parseBuyerPremiumTiers(row.buyerPremiumTiers),
    terms: nullableString(row.terms),
    createdBy: String(row.createdBy ?? ""),
    createdAt: zCoerceDate.parse(row.createdAt),
    updatedAt: zCoerceDate.parse(row.updatedAt),
  };
});

export const saleSchema = saleRowSchema as z.ZodType<Sale>;

export function parseSaleSchema(raw: unknown): Sale {
  return saleSchema.parse(raw);
}

type _SaleInfer = z.infer<typeof saleSchema>;
const _saleTypeGuard = null as unknown as _SaleInfer satisfies Sale;
void _saleTypeGuard;
