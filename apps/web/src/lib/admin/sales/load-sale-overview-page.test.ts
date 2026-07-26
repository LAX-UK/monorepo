import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSaleOverviewPage } from "./load-sale-overview-page";

const {
  loadDetail,
  loadRegistrationCount,
  loadPendingRegistrationCount,
  loadConnect,
  getEvents,
  getMetrics,
  getAttention,
  getTrends,
} = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  loadRegistrationCount: vi.fn(),
  loadPendingRegistrationCount: vi.fn(),
  loadConnect: vi.fn(),
  getEvents: vi.fn(),
  getMetrics: vi.fn(),
  getAttention: vi.fn(),
  getTrends: vi.fn(),
}));

vi.mock("@/lib/admin/load-sale-detail", () => ({
  loadAdminSaleDetail: loadDetail,
  loadAdminSaleRegistrationCount: loadRegistrationCount,
  loadAdminSalePendingRegistrationCount: loadPendingRegistrationCount,
}));

vi.mock("@/lib/admin/connect-readiness", () => ({
  loadSaleConnectRequiredByLotId: loadConnect,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminDomainEventsForAggregate: getEvents,
}));

vi.mock("@/lib/data/http/admin-sale-detail-metrics.server", () => ({
  getAdminSaleDetailMetrics: getMetrics,
}));

vi.mock("@/lib/data/http/admin-sale-attention.server", () => ({
  getAdminSaleAttention: getAttention,
}));

vi.mock("@/lib/data/http/admin-sale-overview-kpi-trends.server", () => ({
  getAdminSaleOverviewKpiTrends: getTrends,
}));

describe("loadAdminSaleOverviewPage", () => {
  beforeEach(() => {
    loadDetail.mockReset();
    loadRegistrationCount.mockReset();
    loadPendingRegistrationCount.mockReset();
    loadConnect.mockReset();
    getEvents.mockReset();
    getMetrics.mockReset();
    getAttention.mockReset();
    getTrends.mockReset();

    loadDetail.mockResolvedValue({
      sale: { id: "sale_1", status: "active" },
      lots: [{ id: "lot_1" }],
    });
    loadRegistrationCount.mockResolvedValue(5);
    loadPendingRegistrationCount.mockResolvedValue(1);
    loadConnect.mockResolvedValue({ lot_1: false });
    getEvents.mockResolvedValue([{ id: "evt_1" }]);
    getMetrics.mockResolvedValue({ lotCount: 1 });
    getAttention.mockResolvedValue({ rows: [] });
    getTrends.mockResolvedValue({ periodDays: 30, tiles: [] });
  });

  it("loads sale overview metrics with parsed KPI period", async () => {
    const result = await loadAdminSaleOverviewPage("sale_1", "7");

    expect(result).toMatchObject({
      saleId: "sale_1",
      registrationCount: 5,
      pendingRegistrationCount: 1,
      connectRequiredByLotId: { lot_1: false },
      activityEvents: [{ id: "evt_1" }],
      metrics: { lotCount: 1 },
      kpiPeriodDays: 7,
    });
    expect(getTrends).toHaveBeenCalledWith("sale_1", 7);
  });

  it("returns empty activity when domain events fail", async () => {
    getEvents.mockRejectedValue(new Error("network"));

    const result = await loadAdminSaleOverviewPage("sale_1");

    expect(result.activityEvents).toEqual([]);
  });
});
