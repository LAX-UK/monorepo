import { afterEach, describe, expect, it, vi } from "vitest";
import { recordDashboardSliceFailure, recordDashboardTelemetry } from "./dashboard-telemetry";

describe("dashboard-telemetry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allowlists telemetry payload fields", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    recordDashboardTelemetry({
      kind: "kpi_drilldown",
      profileId: "finance",
      kpiId: "stale-payments",
    });
    expect(spy).toHaveBeenCalledWith(
      "[admin-dashboard]",
      JSON.stringify({
        kind: "kpi_drilldown",
        profileId: "finance",
        kpiId: "stale-payments",
      }),
    );
    spy.mockRestore();
  });

  it("records work item actions", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    recordDashboardTelemetry({
      kind: "work_item_action",
      itemKind: "payment_manual_review",
      action: "capture",
    });
    expect(spy).toHaveBeenCalledWith(
      "[admin-dashboard]",
      JSON.stringify({
        kind: "work_item_action",
        itemKind: "payment_manual_review",
        action: "capture",
      }),
    );
    spy.mockRestore();
  });

  it("skips logging in test env for slice failures", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    recordDashboardSliceFailure({
      slice: "role-kpis",
      profileId: "catalogue",
      retryable: true,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
