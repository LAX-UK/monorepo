import { requirePlatformAdminAccess } from "./auth.js";
import { analyticsDateRange, summarizeFilters } from "./export-shared.js";
import type { IAnalyticsService } from "./ports/analytics.js";
import type { ExportProvider } from "./types.js";

export function createAnalyticsProvider(analytics: IAnalyticsService): ExportProvider<{
  days: number;
  series: "revenue" | "ended_lots" | "registrations";
}> {
  return {
    entityType: "analytics",
    authorize(ctx) {
      requirePlatformAdminAccess(ctx);
    },
    columns(_ctx, filters) {
      if (filters.series === "revenue") {
        return [
          { key: "date", header: "date" },
          { key: "revenue", header: "revenue" },
        ];
      }
      if (filters.series === "ended_lots") {
        return [
          { key: "date", header: "date" },
          { key: "endedLots", header: "ended_lots" },
        ];
      }
      return [
        { key: "date", header: "date" },
        { key: "registrations", header: "registrations" },
      ];
    },
    async estimateCount(_ctx, filters) {
      return filters.days;
    },
    async *streamRows(_ctx, filters) {
      const dashboard = await analytics.getDashboard(analyticsDateRange(filters.days));
      if (filters.series === "revenue") {
        for (const row of dashboard.revenueSeries) {
          yield { date: row.date, revenue: row.total };
        }
        return;
      }
      if (filters.series === "ended_lots") {
        for (const row of dashboard.lotCompletedSeries) {
          yield { date: row.date, endedLots: String(row.count) };
        }
        return;
      }
      for (const row of dashboard.registrationSeries) {
        yield { date: row.date, registrations: String(row.count) };
      }
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
