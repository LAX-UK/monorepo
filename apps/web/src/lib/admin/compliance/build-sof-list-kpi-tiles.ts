import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { SofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSourceOfFundsListSummary } from "@/lib/data/http/compliance-sof.shared";

export function buildSofListKpiTiles(input: {
  status: SofListStatus;
  summary: AdminSourceOfFundsListSummary;
}): KpiRowTile[] {
  const { status, summary } = input;
  if (status === "pending") {
    return [
      buildSnapshotKpiTile("Awaiting triage", summary.awaitingTriage, 30, {
        compareHint: "Needs analyst review",
        semanticTone: summary.awaitingTriage > 0 ? "warning" : "default",
        trendTone: "accent-gold",
      }),
      buildSnapshotKpiTile("Triaged", summary.triaged, 30, {
        compareHint: "Awaiting MLRO decision",
        trendTone: "info",
      }),
      buildSnapshotKpiTile("Total pending", summary.total, 30, {
        compareHint: "Settlement blocked",
        emphasize: true,
        trendTone: "primary",
      }),
    ];
  }

  const label = status === "rejected" ? "Rejected cases" : "Approved cases";
  return [
    buildSnapshotKpiTile(label, summary.total, 30, {
      compareHint: status === "rejected" ? "Still blocking settlement" : "Gate cleared",
      semanticTone: status === "rejected" && summary.total > 0 ? "warning" : "default",
      trendTone: status === "rejected" ? "live-red" : "success",
      emphasize: true,
    }),
  ];
}

export function buildSofMobileMetrics(input: {
  status: SofListStatus;
  summary: AdminSourceOfFundsListSummary;
  countOnPage: number;
}) {
  const { status, summary, countOnPage } = input;
  if (status === "pending") {
    return [
      { id: "pending", label: "Awaiting triage", value: String(summary.awaitingTriage) },
      { id: "triaged", label: "Triaged", value: String(summary.triaged) },
      { id: "page", label: "On page", value: String(countOnPage) },
    ];
  }
  return [
    {
      id: "total",
      label: status === "rejected" ? "Rejected" : "Approved",
      value: String(summary.total),
    },
    { id: "page", label: "On page", value: String(countOnPage) },
  ];
}
