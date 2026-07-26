import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminOnboardingIssuesLensSummary } from "@/lib/data/http/admin-onboarding-issues.shared";
import { toApiOnboardingTab } from "@/lib/data/http/admin-onboarding-issues.shared";
import type { OnboardingTabId } from "@/lib/data/view-models/admin-onboarding-issues.vm";

export function buildOnboardingIssuesListKpiTiles(
  lensSummary: AdminOnboardingIssuesLensSummary | null | undefined,
  tab: OnboardingTabId,
): KpiRowTile[] {
  const apiTab = toApiOnboardingTab(tab);
  if (!lensSummary || lensSummary.tab !== apiTab) {
    return [
      buildSnapshotKpiTile("Open in tab", 0, 30, {
        compareHint: "Active lens",
        trendTone: "secondary",
      }),
    ];
  }

  switch (lensSummary.tab) {
    case "entities":
      return [
        buildSnapshotKpiTile("Entities", lensSummary.summary.total, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
        buildSnapshotKpiTile("Docs received", lensSummary.summary.docsReceived, 30, {
          compareHint: "Active lens",
          trendTone: "accent-gold",
        }),
        buildSnapshotKpiTile("Under review", lensSummary.summary.underReview, 30, {
          compareHint: "Active lens",
          semanticTone: lensSummary.summary.underReview > 0 ? "warning" : "default",
          trendTone: "accent-gold",
        }),
      ];
    case "artists":
      return [
        buildSnapshotKpiTile("Artists", lensSummary.summary.total, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
      ];
    case "kyc":
      return [
        buildSnapshotKpiTile("Sessions", lensSummary.summary.total, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
        buildSnapshotKpiTile("Created", lensSummary.summary.created, 30, {
          compareHint: "Active lens",
          trendTone: "accent-gold",
        }),
        buildSnapshotKpiTile("Needs input", lensSummary.summary.requiresInput, 30, {
          compareHint: "Active lens",
          semanticTone: lensSummary.summary.requiresInput > 0 ? "warning" : "default",
          trendTone: "accent-gold",
        }),
        buildSnapshotKpiTile("Processing", lensSummary.summary.processing, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
      ];
    case "organizations":
      return [
        buildSnapshotKpiTile("Lead orgs", lensSummary.summary.total, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
      ];
    case "documents":
      return [
        buildSnapshotKpiTile("Documents", lensSummary.summary.total, 30, {
          compareHint: "Active lens",
          trendTone: "secondary",
        }),
      ];
    default: {
      const _exhaustive: never = lensSummary;
      return _exhaustive;
    }
  }
}

export function buildOnboardingIssuesMobileMetrics(
  lensSummary: AdminOnboardingIssuesLensSummary | null | undefined,
  tab: OnboardingTabId,
) {
  const tiles = buildOnboardingIssuesListKpiTiles(lensSummary, tab);
  return tiles.map((tile, index) => ({
    id: `onboarding-${tab}-${index}`,
    label: String(tile.label),
    value: String(tile.value),
  }));
}
