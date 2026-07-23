import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { saleMediaPublishedDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import type { SaleDayMediaRef } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

export type SaleMediaFilter = "all" | "published" | "drafts";

export const SALE_MEDIA_FILTERS: DetailBoardFilter<SaleMediaFilter>[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "drafts", label: "Drafts" },
];

export function buildSaleMediaKpiTiles(items: readonly SaleDayMediaRef[]): DetailBoardKpiTile[] {
  const photos = items.filter((i) => i.mediaType === "image").length;
  const videos = items.filter((i) => i.mediaType === "video").length;
  return [
    {
      id: "total",
      label: "Total media",
      value: String(items.length),
      compareHint: "Photos & videos",
    },
    {
      id: "photos",
      label: "Photos",
      value: String(photos),
      compareHint: "Images uploaded",
    },
    {
      id: "videos",
      label: "Videos",
      value: String(videos),
      compareHint: "Video clips",
    },
  ];
}

export function filterSaleMediaItems<T extends SaleDayMediaRef>(
  items: readonly T[],
  filter: SaleMediaFilter,
  isPublished: boolean,
): T[] {
  if (filter === "published") return isPublished ? [...items] : [];
  if (filter === "drafts") return isPublished ? [] : [...items];
  return [...items];
}

export function matchesSaleMediaSearch(item: SaleDayMediaRef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const caption = "caption" in item && item.caption ? item.caption : "";
  const alt = "alt" in item && item.alt ? item.alt : "";
  return (
    caption.toLowerCase().includes(q) ||
    alt.toLowerCase().includes(q) ||
    item.key.toLowerCase().includes(q)
  );
}

export function saleMediaPublishedLabel(isPublished: boolean): string {
  return saleMediaPublishedDotStatus(isPublished).label;
}

export function saleMediaPublishedTone(isPublished: boolean): DotStatusPillTone {
  return saleMediaPublishedDotStatus(isPublished).tone;
}
