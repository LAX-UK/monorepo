import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminLotOverviewPage } from "./load-lot-overview-page";

const { loadDetail, getBids, getMetrics, getAttention, getTrends, getEvents } = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  getBids: vi.fn(),
  getMetrics: vi.fn(),
  getAttention: vi.fn(),
  getTrends: vi.fn(),
  getEvents: vi.fn(),
}));

vi.mock("@/lib/admin/load-lot-detail", () => ({
  loadAdminLotDetail: loadDetail,
}));

vi.mock("@/lib/data/http/lots.server", () => ({
  getServerLotBids: getBids,
}));

vi.mock("@/lib/data/http/admin-lot-detail-metrics.server", () => ({
  getAdminLotDetailMetrics: getMetrics,
}));

vi.mock("@/lib/data/http/admin-lot-attention.server", () => ({
  getAdminLotAttention: getAttention,
}));

vi.mock("@/lib/data/http/admin-lot-overview-kpi-trends.server", () => ({
  getAdminLotOverviewKpiTrends: getTrends,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminDomainEventsForAggregate: getEvents,
}));

describe("loadAdminLotOverviewPage", () => {
  beforeEach(() => {
    loadDetail.mockReset();
    getBids.mockReset();
    getMetrics.mockReset();
    getAttention.mockReset();
    getTrends.mockReset();
    getEvents.mockReset();

    loadDetail.mockResolvedValue({
      auction: { id: "lot_1", title: "Vase" },
      context: { sale: null, artist: null, categories: [], seller: null, parentSaleLotCount: null },
    });
    getBids.mockResolvedValue([{ id: "bid_1" }, { id: "bid_2" }]);
    getMetrics.mockResolvedValue({ bidCount: 2 });
    getAttention.mockResolvedValue({ rows: [] });
    getTrends.mockResolvedValue({ periodDays: 30, tiles: [] });
    getEvents.mockResolvedValue([{ id: "evt_1" }]);
  });

  it("loads lot overview metrics and bid count", async () => {
    const result = await loadAdminLotOverviewPage("lot_1", "30");

    expect(result).toMatchObject({
      lotId: "lot_1",
      bidCount: 2,
      activityEvents: [{ id: "evt_1" }],
      metrics: { bidCount: 2 },
      kpiPeriodDays: 30,
    });
  });

  it("defaults bid count to zero when bids fail", async () => {
    getBids.mockRejectedValue(new Error("network"));

    const result = await loadAdminLotOverviewPage("lot_1");

    expect(result.bidCount).toBe(0);
  });
});
