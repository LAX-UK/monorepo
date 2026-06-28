import "server-only";

import { coerceToIsoString } from "@/lib/data/http/parse";
import type {
  PressArchiveEntry,
  PressDayMediaSaleSummary,
  PressHubMeta,
  PressSitemapSaleFreshness,
  SaleDeliveryMode,
  SalePressRef,
  SaleStatus,
} from "@auction/types";

type ApiPressArchiveSale = {
  id: string;
  title: string;
  status: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  endTime: string | null;
  updatedAt: string;
};

type ApiPressArchiveEntry = {
  sale: ApiPressArchiveSale;
  item: SalePressRef;
};

function parsePressArchiveSale(raw: ApiPressArchiveSale): PressArchiveEntry["sale"] | null {
  const updatedAt = coerceToIsoString(raw.updatedAt);
  if (!updatedAt) return null;
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    deliveryMode: raw.deliveryMode,
    endTime: raw.endTime ? new Date(raw.endTime) : null,
    updatedAt: new Date(updatedAt),
  };
}

export function parsePressArchiveEntry(raw: ApiPressArchiveEntry): PressArchiveEntry | null {
  const sale = parsePressArchiveSale(raw.sale);
  if (!sale) return null;
  return {
    sale,
    item: raw.item,
  };
}

export function parsePressArchiveListResponse(body: {
  data?: ApiPressArchiveEntry[];
  meta?: { total?: number; lastUpdated?: string | null; availableYears?: number[] };
}): { data: PressArchiveEntry[]; meta: PressHubMeta } {
  const data = (body.data ?? [])
    .map(parsePressArchiveEntry)
    .filter((entry): entry is PressArchiveEntry => entry != null);
  const lastUpdatedRaw = body.meta?.lastUpdated;
  const lastUpdated =
    lastUpdatedRaw != null && lastUpdatedRaw !== "" ? new Date(lastUpdatedRaw) : null;
  const availableYears = Array.isArray(body.meta?.availableYears)
    ? body.meta.availableYears.filter(
        (y): y is number => typeof y === "number" && Number.isFinite(y),
      )
    : [];
  return {
    data,
    meta: {
      total: typeof body.meta?.total === "number" ? body.meta.total : data.length,
      lastUpdated: lastUpdated && Number.isFinite(lastUpdated.getTime()) ? lastUpdated : null,
      availableYears,
    },
  };
}

export function parsePressDayMediaSalesResponse(body: {
  data?: Array<{
    id: string;
    title: string;
    deliveryMode: SaleDeliveryMode;
    endTime: string | null;
    coverImages: string[];
    dayImageCount: number;
  }>;
}): PressDayMediaSaleSummary[] {
  return (body.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    deliveryMode: row.deliveryMode,
    endTime: row.endTime ? new Date(row.endTime) : null,
    coverImages: row.coverImages,
    dayImageCount: row.dayImageCount,
  }));
}

export function parsePressSitemapFreshnessResponse(body: {
  data?: Array<{
    saleId: string;
    title: string;
    lastModified: string;
    previewImageSrc: string | null;
  }>;
}): PressSitemapSaleFreshness[] {
  return (body.data ?? []).map((row) => ({
    saleId: row.saleId,
    title: row.title,
    lastModified: new Date(row.lastModified),
    previewImageSrc: row.previewImageSrc,
  }));
}
