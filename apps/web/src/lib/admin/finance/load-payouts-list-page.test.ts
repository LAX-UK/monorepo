import { describe, expect, it, vi } from "vitest";
import { loadAdminPayoutsListPage } from "./load-payouts-list-page";

const { getPage, getTrend, getSession } = vi.hoisted(() => ({
  getPage: vi.fn(),
  getTrend: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/data/http/admin-payouts.reader", () => ({
  getAdminPayoutsPage: getPage,
}));
vi.mock("@/lib/data/http/admin-kpi-trends.server", () => ({
  getAdminPayoutsKpiTrend: getTrend,
}));
vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({
  getAdminNavCounts: vi.fn().mockResolvedValue({ payoutsFailed: 0, clawbackPending: 0 }),
}));
vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: getSession,
}));

describe("loadAdminPayoutsListPage", () => {
  it("returns truthful summary without page-local aggregation", async () => {
    getSession.mockResolvedValue({ role: "staff", staffRole: "finance_ops" });
    getTrend.mockResolvedValue({ currentTotal: 1, priorTotal: 0, dailyCounts: [1] });
    getPage.mockResolvedValue({
      rows: [{ id: "p1" }],
      total: 40,
      offset: 25,
      limit: 25,
      summary: {
        total: 40,
        scheduled: 10,
        inTransit: 5,
        paid: 20,
        failed: 3,
        reversed: 1,
        clawbackPending: 1,
        totalNet: "1000.00",
        readiness: {
          inFlightCount: 15,
          missingTransferRefCount: 2,
          withFailureReasonCount: 1,
          withStatementErrorCount: 0,
          clawbackCount: 1,
          failedCount: 3,
          reversedCount: 1,
          blockerPayoutCount: 4,
        },
      },
      hasNextPage: false,
    });

    const result = await loadAdminPayoutsListPage({ offset: "25" });

    expect(result.loadError).toBeNull();
    expect(result.summary.total).toBe(40);
    expect(result.summary.readiness.inFlightCount).toBe(15);
    expect(result.capabilities.canProcess).toBe(true);
  });

  it("contains list failures and preserves the page model", async () => {
    getSession.mockResolvedValue(null);
    getTrend.mockResolvedValue({ currentTotal: 0, priorTotal: 0, dailyCounts: [] });
    getPage.mockRejectedValue(new Error("Payouts unavailable"));

    const result = await loadAdminPayoutsListPage({ status: "failed" });

    expect(result.loadError).toBe("Payouts unavailable");
    expect(result.rows).toEqual([]);
    expect(result.model.hasFilters).toBe(true);
  });
});
