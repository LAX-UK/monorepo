import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminDashboardPage } from "./load-admin-dashboard-page";

const {
  getMetricsToday,
  getMetricsLive,
  getLotList,
  getAttentionFeed,
  getHomeTrends,
  getFinanceIssues,
  getNavCounts,
  getSalesList,
  getOpsSnapshot,
} = vi.hoisted(() => ({
  getMetricsToday: vi.fn(),
  getMetricsLive: vi.fn(),
  getLotList: vi.fn(),
  getAttentionFeed: vi.fn(),
  getHomeTrends: vi.fn(),
  getFinanceIssues: vi.fn(),
  getNavCounts: vi.fn(),
  getSalesList: vi.fn(),
  getOpsSnapshot: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminMetricsToday: getMetricsToday,
  getAdminMetricsLive: getMetricsLive,
  getAdminLotList: getLotList,
  getAdminAttentionFeed: getAttentionFeed,
  getAdminFinanceIssues: getFinanceIssues,
  getAdminSalesList: getSalesList,
  getAdminSaleOperationsSnapshot: getOpsSnapshot,
}));

vi.mock("@/lib/data/http/admin-kpi-trends.server", () => ({
  getAdminHomeKpiTrends: getHomeTrends,
}));

vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({
  getAdminNavCounts: getNavCounts,
}));

describe("loadAdminDashboardPage", () => {
  beforeEach(() => {
    getMetricsToday.mockResolvedValue({
      liveLots: 2,
      endingWithinHour: 1,
      draftLots: 0,
      pendingSubmissions: 3,
      stalePendingPayments: 0,
      revenueToday: "100",
    });
    getMetricsLive.mockResolvedValue({ bidsPerMinute: 4 });
    getLotList.mockResolvedValue([]);
    getAttentionFeed.mockResolvedValue([]);
    getHomeTrends.mockResolvedValue({
      lots: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
      submissions: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
      payments: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
    });
    getFinanceIssues.mockResolvedValue(null);
    getNavCounts.mockResolvedValue({});
    getSalesList.mockResolvedValue([]);
    getOpsSnapshot.mockResolvedValue(null);
  });

  it("returns dashboard metrics and hub links for staff", async () => {
    const result = await loadAdminDashboardPage({
      periodDays: 30,
      role: "staff",
      staffRole: "super_admin",
      widgets: [{ id: "greeting", order: 0, hidden: false }],
    });

    expect(result.metrics.liveLots).toBe(2);
    expect(result.bidsPerMinute).toBe(4);
    expect(result.hubLinks.length).toBeGreaterThan(0);
    expect(result.loadWarning).toBeNull();
  });

  it("surfaces a load warning when core metrics fail", async () => {
    getMetricsToday.mockRejectedValue(new Error("boom"));

    const result = await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: null,
      widgets: [],
    });

    expect(result.loadWarning).toBe("Could not load dashboard metrics.");
  });
});
