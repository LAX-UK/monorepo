import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { detectAnomaliesFromNavCounts } from "./anomaly-detection";

describe("detectAnomalies", () => {
  it("returns warning manual review when one payment needs review", () => {
    const result = detectAnomaliesFromNavCounts({
      ...EMPTY_ADMIN_NAV_COUNTS,
      manualReviewCount: 1,
    });
    expect(result.some((a) => a.id === "manual-review" && a.severity === "warning")).toBe(true);
  });

  it("returns critical manual review when the count exceeds the baseline", () => {
    const result = detectAnomaliesFromNavCounts({
      ...EMPTY_ADMIN_NAV_COUNTS,
      manualReviewCount: 2,
    });
    expect(result.some((a) => a.id === "manual-review" && a.severity === "critical")).toBe(true);
  });

  it("returns warning for high condition report backlog", () => {
    const result = detectAnomaliesFromNavCounts({
      ...EMPTY_ADMIN_NAV_COUNTS,
      conditionReportsPending: 8,
    });
    expect(result.some((a) => a.id === "condition-reports")).toBe(true);
  });

  it("raises a critical anomaly for blocked payouts, linking to that view", () => {
    const result = detectAnomaliesFromNavCounts(EMPTY_ADMIN_NAV_COUNTS, { payoutsBlocked: 2 });
    expect(result).toContainEqual({
      id: "blocked-payouts",
      severity: "critical",
      message: "2 payouts blocked, need review",
      href: "/admin/payouts?status=transfer_blocked",
    });
  });

  it("words a single blocked payout in the singular", () => {
    const [anomaly] = detectAnomaliesFromNavCounts(EMPTY_ADMIN_NAV_COUNTS, { payoutsBlocked: 1 });
    expect(anomaly?.message).toBe("1 payout blocked, needs review");
  });

  it("returns empty when all counts are zero", () => {
    expect(detectAnomaliesFromNavCounts(EMPTY_ADMIN_NAV_COUNTS)).toEqual([]);
  });
});
