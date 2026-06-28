import { formatPressArticleCount } from "@/lib/marketing/press-params";
import type { PressHubMeta } from "@auction/types";

export type PressHubStats = {
  totalArticles: number;
  outletCount: number;
  oldestYear: number | null;
};

/** Maps API meta into hero stats (archive-wide counts, not page-local). */
export function computePressHubStats(meta: PressHubMeta): PressHubStats {
  const oldestYear = meta.availableYears.at(-1) ?? null;

  return {
    totalArticles: meta.archiveTotal,
    outletCount: meta.outletCount,
    oldestYear,
  };
}

export function formatPressHubStatsLabel(stats: PressHubStats): string {
  const parts: string[] = [formatPressArticleCount(stats.totalArticles)];

  if (stats.outletCount > 0) {
    parts.push(`${stats.outletCount} outlet${stats.outletCount === 1 ? "" : "s"}`);
  }

  if (stats.oldestYear != null) {
    parts.push(`Since ${stats.oldestYear}`);
  }

  return parts.join(" · ");
}
