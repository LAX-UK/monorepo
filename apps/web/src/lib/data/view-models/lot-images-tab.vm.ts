import type { DetailCardGridItem } from "@/components/admin/catalog/detail-board/detail-card-grid";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { ReactNode } from "react";

export function buildLotImagesKpiTiles(imageCount: number): DetailBoardKpiTile[] {
  return [
    {
      id: "total",
      label: "Total images",
      value: String(imageCount),
      compareHint: imageCount === 0 ? "Add at least one" : "Catalogue media",
    },
    {
      id: "hero",
      label: "Hero image",
      value: imageCount > 0 ? "Set" : "Missing",
      compareHint: "First image in list",
      trendTone: imageCount > 0 ? "success" : "secondary",
    },
  ];
}

export function buildLotImageGridItems(
  entries: readonly { key: string; alt?: string }[],
  renderImage: (key: string, alt: string) => ReactNode,
): DetailCardGridItem[] {
  return entries.map((entry, i) => ({
    id: entry.key,
    title: entry.alt?.trim() || `Image ${i + 1}`,
    subtitle: i === 0 ? "Primary" : undefined,
    image: renderImage(entry.key, entry.alt?.trim() || `Image ${i + 1}`),
  }));
}
