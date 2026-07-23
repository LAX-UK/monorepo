import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import type { SalePressRef } from "@auction/types";

export function buildSalePressKpiTiles(
  items: readonly (SalePressRef & { id?: string })[],
): DetailBoardKpiTile[] {
  const published = items.filter((i) => i.headline?.trim()).length;
  const dates = items
    .map((i) => i.publishedAt)
    .filter((d): d is string => Boolean(d?.trim()))
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()));
  const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
  const latest =
    sortedDates[0] != null ? formatAdminTableDateTime(sortedDates[0], "timestamp").primary : "—";

  return [
    {
      id: "total",
      label: "Total articles",
      value: String(items.length),
      compareHint: "Press mentions",
    },
    {
      id: "published",
      label: "Published",
      value: String(published),
      compareHint: "With headlines",
    },
    {
      id: "latest",
      label: "Latest coverage",
      value: latest,
      compareHint: "Most recent mention",
    },
  ];
}

export function matchesSalePressSearch(item: SalePressRef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [item.headline, item.outletName, item.excerpt, item.mentionType];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function pressMentionTypeLabel(type: SalePressRef["mentionType"]): string {
  if (!type) return "Coverage";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Short en-GB date label aligned with marketing press cards. */
export function formatSalePressDate(publishedAt?: string | null): string | null {
  if (!publishedAt?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${publishedAt.trim()}T12:00:00Z`));
  } catch {
    return publishedAt;
  }
}
