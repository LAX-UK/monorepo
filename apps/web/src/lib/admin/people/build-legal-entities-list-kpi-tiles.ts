import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminLegalEntityListSummary } from "@/lib/data/http/admin-legal-entities.shared";

function underReviewCount(summary: AdminLegalEntityListSummary): number {
  return summary.byStatus.under_review + summary.byStatus.connect_pending;
}

export function buildLegalEntitiesListKpiTiles(input: {
  summary: AdminLegalEntityListSummary;
  stripeLens: boolean;
}): KpiRowTile[] {
  const { summary, stripeLens } = input;

  if (stripeLens) {
    return [
      buildSnapshotKpiTile("Stripe requirements", summary.stripeDueCount, 30, {
        compareHint: "Org-wide",
        semanticTone: summary.stripeDueCount > 0 ? "warning" : "default",
        trendTone: "accent-gold",
      }),
      buildSnapshotKpiTile("Total entities", summary.total, 30, {
        compareHint: "Org-wide",
        trendTone: "secondary",
      }),
      buildSnapshotKpiTile("Under review", underReviewCount(summary), 30, {
        compareHint: "Org-wide",
        trendTone: "info",
      }),
    ];
  }

  return [
    buildSnapshotKpiTile("Total entities", summary.total, 30, {
      compareHint: "Org-wide",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Stripe requirements", summary.stripeDueCount, 30, {
      compareHint: "Org-wide",
      semanticTone: summary.stripeDueCount > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Approved", summary.byStatus.approved, 30, {
      compareHint: "Org-wide",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Under review", underReviewCount(summary), 30, {
      compareHint: "Org-wide",
      trendTone: "info",
    }),
  ];
}

export function buildLegalEntitiesMobileMetrics(input: {
  summary: AdminLegalEntityListSummary;
  stripeLens: boolean;
  pageCount: number;
}) {
  const { summary, stripeLens, pageCount } = input;
  if (stripeLens) {
    return [
      { id: "stripe", label: "Stripe requirements", value: String(summary.stripeDueCount) },
      { id: "total", label: "Total entities", value: String(summary.total) },
      ...(pageCount > 0 ? [{ id: "page", label: "On page", value: String(pageCount) }] : []),
    ];
  }
  return [
    { id: "total", label: "Total entities", value: String(summary.total) },
    { id: "stripe", label: "Stripe requirements", value: String(summary.stripeDueCount) },
    ...(pageCount > 0 ? [{ id: "page", label: "On page", value: String(pageCount) }] : []),
  ];
}
