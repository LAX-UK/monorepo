import type { sale } from "@auction/db/schema";
import type {
  Sale,
  SaleDayMediaRef,
  SaleDeliveryMode,
  SalePressRef,
  SaleStatus,
} from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type SaleRow = InferSelectModel<typeof sale>;

function requireBackfilledLegalEntityId(value: string | null, context: string): string {
  if (!value) {
    throw new Error(`missing_backfilled_legal_entity_id:${context}`);
  }
  return value;
}

function parsePressRefs(raw: unknown): SalePressRef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SalePressRef[] = [];
  for (const entry of raw as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : null;
    const headline = typeof o.headline === "string" ? o.headline.trim() : null;
    const outletName = typeof o.outletName === "string" ? o.outletName.trim() : null;
    if (!url || !headline || !outletName) continue;
    const ref: SalePressRef = { url, headline, outletName };
    if (typeof o.publishedAt === "string" && o.publishedAt.trim())
      ref.publishedAt = o.publishedAt.trim();
    if (typeof o.excerpt === "string" && o.excerpt.trim()) ref.excerpt = o.excerpt.trim();
    if (
      typeof o.mentionType === "string" &&
      ["feature", "interview", "quote", "roundup"].includes(o.mentionType)
    ) {
      ref.mentionType = o.mentionType as import("@auction/types").SalePressMentionType;
    }
    if (typeof o.imageUrl === "string" && o.imageUrl.trim()) ref.imageUrl = o.imageUrl.trim();
    out.push(ref);
  }
  return out.length > 0 ? out : undefined;
}

function parseDayImageRefs(raw: unknown): SaleDayMediaRef[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SaleDayMediaRef[] = [];
  for (const entry of raw as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : null;
    if (!key) continue;
    const isVideo = o.mediaType === "video";
    if (isVideo) {
      const ref: import("@auction/types").SaleDayVideoRef = { mediaType: "video", key };
      if (typeof o.caption === "string" && o.caption) ref.caption = o.caption;
      if (typeof o.posterKey === "string" && o.posterKey) ref.posterKey = o.posterKey;
      out.push(ref);
    } else {
      const ref: import("@auction/types").SaleDayPhotoRef = { key };
      if (o.mediaType === "image") ref.mediaType = "image";
      if (typeof o.caption === "string" && o.caption) ref.caption = o.caption;
      if (typeof o.alt === "string" && o.alt) ref.alt = o.alt;
      out.push(ref);
    }
  }
  return out.length > 0 ? out : undefined;
}

export function mapSaleRow(row: SaleRow, categoryIds: string[] = []): Sale {
  const dayImagesRaw = (row as Record<string, unknown>).auctionDayImages;
  const dayImages = parseDayImageRefs(dayImagesRaw);
  const pressCoverageRaw = (row as Record<string, unknown>).pressCoverage;
  const pressCoverage = parsePressRefs(pressCoverageRaw);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverImages: row.coverImages ?? [],
    categoryIds,
    categoryId: categoryIds[0] ?? null,
    deliveryMode: (row.deliveryMode ?? "onsite") as SaleDeliveryMode,
    allowOnlineBidsBeforeGoLive: row.allowOnlineBidsBeforeGoLive ?? false,
    streamUrl: row.streamUrl ?? null,
    heroPresentation: row.heroPresentation,
    heroVideoUrl: row.heroVideoUrl ?? null,
    locationName: row.locationName ?? null,
    locationAddress: row.locationAddress ?? null,
    locationMapUrl: row.locationMapUrl ?? null,
    locationAddressLine1: row.locationAddressLine1 ?? null,
    locationAddressLine2: row.locationAddressLine2 ?? null,
    locationCity: row.locationCity ?? null,
    locationCounty: row.locationCounty ?? null,
    locationPostcode: row.locationPostcode ?? null,
    locationCountry: row.locationCountry ?? null,
    venueId: row.venueId ?? null,
    status: row.status as SaleStatus,
    startTime: row.startTime,
    endTime: row.endTime,
    previewStartTime: row.previewStartTime ?? null,
    buyerPremiumRate: String(row.buyerPremiumRate),
    buyerPremiumTiers: row.buyerPremiumTiers ?? null,
    terms: row.terms ?? null,
    ...(dayImages !== undefined ? { dayImages } : {}),
    ...(pressCoverage !== undefined ? { pressCoverage } : {}),
    createdByLegalEntityId: requireBackfilledLegalEntityId(
      row.createdByLegalEntityId,
      `sale:${row.id}`,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    deletedByUserId: row.deletedByUserId ?? null,
  };
}

export type { SaleRow };
