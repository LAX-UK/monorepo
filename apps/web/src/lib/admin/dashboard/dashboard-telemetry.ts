type DashboardTelemetryEvent =
  | { kind: "slice_failure"; slice: string; profileId: string; retryable: boolean }
  | { kind: "kpi_drilldown"; profileId: string; kpiId: string }
  | { kind: "queue_open"; profileId: string; rowId: string }
  | { kind: "work_item_action"; itemKind: string; action: string }
  | { kind: "customize_save"; profileId: string; widgetCount: number };

/** Non-PII dashboard interaction and failure evidence (server logs only). */
export function recordDashboardTelemetry(event: DashboardTelemetryEvent): void {
  if (process.env.NODE_ENV === "test") return;
  console.info("[admin-dashboard]", JSON.stringify(event));
}

export function recordDashboardSliceFailure(input: {
  slice: string;
  profileId: string;
  retryable: boolean;
}): void {
  recordDashboardTelemetry({
    kind: "slice_failure",
    slice: input.slice,
    profileId: input.profileId,
    retryable: input.retryable,
  });
}
