import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminLotBidsPage } from "./load-lot-bids-page";

const { loadDetail, getBids, getUsers } = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  getBids: vi.fn(),
  getUsers: vi.fn(),
}));

vi.mock("@/lib/admin/load-lot-detail", () => ({
  loadAdminLotDetail: loadDetail,
}));

vi.mock("@/lib/data/http/lots.server", () => ({
  getServerLotBids: getBids,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminUsersByIds: getUsers,
}));

describe("loadAdminLotBidsPage", () => {
  beforeEach(() => {
    loadDetail.mockReset();
    getBids.mockReset();
    getUsers.mockReset();

    loadDetail.mockResolvedValue({ auction: { id: "lot_1" } });
    getBids.mockResolvedValue([
      { id: "bid_1", bidderId: "user_1", amount: "100", placedAt: "2026-01-01T00:00:00Z" },
    ]);
    getUsers.mockResolvedValue([{ id: "user_1", name: "Bidder One", email: "bidder@example.com" }]);
  });

  it("builds bid table rows with resolved bidder labels", async () => {
    const result = await loadAdminLotBidsPage("lot_1");

    expect(result.lotId).toBe("lot_1");
    expect(result.capped).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.bidderLabel).toBe("Bidder One");
  });

  it("returns empty rows when bids fail", async () => {
    getBids.mockRejectedValue(new Error("network"));

    const result = await loadAdminLotBidsPage("lot_1");

    expect(result.rows).toEqual([]);
    expect(result.capped).toBe(false);
  });
});
