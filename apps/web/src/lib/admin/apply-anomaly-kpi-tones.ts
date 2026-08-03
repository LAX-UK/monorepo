import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";
import type { RoleKpiDefinitionId } from "@/lib/admin/dashboard/role-kpis.slice";

const ANOMALY_KPI_MAP: Record<string, RoleKpiDefinitionId> = {
  "stale-payments": "stale-payments",
  "manual-review": "payments",
  "submission-backlog": "submissions",
  "failed-payouts": "revenue-today",
  "disputes-open": "payments",
  "condition-reports": "new-lots",
  "onboarding-issues": "submissions",
};

/** Fold anomaly severities into KPI tile warning tones (replaces standalone anomalies widget). */
export function anomalyToneByKpiId(
  anomalies: readonly AdminAnomaly[],
): Partial<Record<RoleKpiDefinitionId, "warning">> {
  const tones: Partial<Record<RoleKpiDefinitionId, "warning">> = {};
  for (const anomaly of anomalies) {
    if (anomaly.severity === "info") continue;
    const kpiId = ANOMALY_KPI_MAP[anomaly.id];
    if (kpiId) tones[kpiId] = "warning";
  }
  return tones;
}
