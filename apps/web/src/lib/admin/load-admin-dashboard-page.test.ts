import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DASHBOARD_WIDGETS, mergeDashboardWidgets } from "./dashboard-widgets.vm";
import { loadAdminDashboardPage } from "./load-admin-dashboard-page";

const {
  getMetricsToday,
  getMetricsLive,
  getLotList,
  getHomeTrends,
  getFinanceIssues,
  getNavCounts,
  getOpsRadar,
  getWorkItems,
  getSaleReadiness,
} = vi.hoisted(() => ({
  getMetricsToday: vi.fn(),
  getMetricsLive: vi.fn(),
  getLotList: vi.fn(),
  getHomeTrends: vi.fn(),
  getFinanceIssues: vi.fn(),
  getNavCounts: vi.fn(),
  getOpsRadar: vi.fn(),
  getWorkItems: vi.fn(),
  getSaleReadiness: vi.fn(),
}));

describe("loadAdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    getHomeTrends.mockResolvedValue({
      lots: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
      submissions: { currentTotal: 2, priorTotal: 1, dailyCounts: [2] },
      payments: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
    });
    getFinanceIssues.mockResolvedValue(null);
    getNavCounts.mockResolvedValue(EMPTY_ADMIN_NAV_COUNTS);
    getOpsRadar.mockResolvedValue([]);
    getWorkItems.mockResolvedValue({
      items: [],
      nextCursor: null,
      counts: {
        total: 0,
        urgent: 0,
        byDomain: {
          finance: 0,
          compliance: 0,
          catalogue: 0,
          saleroom: 0,
          fulfilment: 0,
          clients: 0,
        },
      },
    });
    getSaleReadiness.mockResolvedValue([]);
  });

  it("returns dashboard metrics and slices for staff", async () => {
    const result = await loadAdminDashboardPage({
      periodDays: 30,
      role: "staff",
      staffRole: "super_admin",
      actorUserId: "user-1",
      widgets: mergeDashboardWidgets(
        DEFAULT_DASHBOARD_WIDGETS.map((w) =>
          w.id === "greeting" ? { ...w, hidden: false } : { ...w, hidden: true },
        ),
        "super_admin",
      ),
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(result.metrics.liveLots).toBe(2);
    expect(result.bidsPerMinute).toBe(0);
    expect(result.loadWarning).toBeNull();
    expect(result.workInbox.status).toBe("empty");
    expect(result.primaryAction.href).toBeTruthy();
    expect(getOpsRadar).not.toHaveBeenCalled();
  });

  it("uses batched operations radar for saleroom-capable roles", async () => {
    await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: "auction_manager",
      actorUserId: "user-1",
      widgets: [
        { id: "onsite-radar", order: 0, hidden: false },
        { id: "saleroom-live", order: 1, hidden: false },
      ],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(getOpsRadar).toHaveBeenCalledWith(6);
    expect(getOpsRadar).toHaveBeenCalledOnce();
  });

  it("requests capability-aware KPI trends", async () => {
    await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: "catalogue_manager",
      actorUserId: "user-1",
      widgets: [],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(getHomeTrends).toHaveBeenCalledWith(7, {
      includeSubmissions: true,
      includePayments: false,
    });
  });

  it("surfaces a load warning when core metrics fail", async () => {
    getMetricsToday.mockRejectedValue(new Error("boom"));

    const result = await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: null,
      actorUserId: "user-1",
      widgets: [],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(result.loadWarning).toBe("Could not load dashboard metrics.");
  });

  it("marks role KPIs unavailable when trends fail", async () => {
    getHomeTrends.mockRejectedValue(new Error("trend down"));

    const result = await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: "super_admin",
      actorUserId: "user-1",
      widgets: [{ id: "kpi-band", order: 0, hidden: false }],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(result.roleKpis.status).toBe("unavailable");
    expect(result.metrics.liveLots).toBe(2);
  });

  it("marks work inbox and sale readiness unavailable when their sources fail", async () => {
    getWorkItems.mockRejectedValue(new Error("work sources down"));
    getSaleReadiness.mockRejectedValue(new Error("readiness source down"));

    const result = await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: "auction_manager",
      actorUserId: "user-1",
      widgets: [
        { id: "my-queue", order: 0, hidden: false },
        { id: "saleroom-live", order: 1, hidden: false },
      ],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(result.workInbox.status).toBe("unavailable");
    expect(result.saleReadiness.status).toBe("unavailable");
    expect(result.loadWarning).toBe("Could not load work inbox.");
  });

  it("uses server assignment filtering and recomputes counts after profile filtering", async () => {
    const baseItem = {
      subtitle: null,
      href: "/admin/test",
      saleId: null,
      createdAt: "2026-07-27T10:00:00.000Z",
      sourceUpdatedAt: "2026-07-27T10:00:00.000Z",
      dueAt: null,
      severity: "medium" as const,
      assignedToUserId: "user-1",
      actions: [],
    };
    getWorkItems.mockResolvedValue({
      items: [
        {
          ...baseItem,
          id: "submission_review:sub-1",
          kind: "submission_review",
          domain: "catalogue",
          title: "Catalogue item",
        },
        {
          ...baseItem,
          id: "payment_manual_review:pay-1",
          kind: "payment_manual_review",
          domain: "finance",
          title: "Finance item",
        },
      ],
      nextCursor: null,
      counts: {
        total: 2,
        urgent: 0,
        byDomain: {
          finance: 1,
          compliance: 0,
          catalogue: 1,
          saleroom: 0,
          fulfilment: 0,
          clients: 0,
        },
      },
    });

    const result = await loadAdminDashboardPage({
      periodDays: 7,
      role: "staff",
      staffRole: "catalogue_manager",
      actorUserId: "user-1",
      workAssignment: "mine",
      widgets: [{ id: "my-queue", order: 0, hidden: false }],
      dataSources: {
        getMetricsToday,
        getMetricsLive,
        getNavCounts,
        getFinanceIssues,
        getHomeKpiTrends: getHomeTrends,
        getActiveLots: () => getLotList({ status: "active", limit: 20 }),
        getRecentLots: () => getLotList({ limit: 12 }),
        getOperationsRadar: getOpsRadar,
        getWorkItems,
        getSaleReadiness,
      },
    });

    expect(getWorkItems).toHaveBeenCalledWith({
      limit: 50,
      assignment: "mine",
    });
    expect(result.workInbox.status).toBe("ready");
    if (result.workInbox.status === "ready") {
      expect(result.workInbox.data.counts.total).toBe(1);
      expect(result.workInbox.data.counts.byDomain.finance).toBe(0);
      expect(result.workInbox.data.counts.byDomain.catalogue).toBe(1);
    }
  });
});
