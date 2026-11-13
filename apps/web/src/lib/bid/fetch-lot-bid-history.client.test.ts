import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/data/http/hc-browser", () => ({
  browserApiBase: () => "https://api.test",
  browserFetch: vi.fn(),
  getBrowserHc: () => ({ lots: { ":id": { bids: { $get: get } } } }),
}));

import { fetchLotBidHistory } from "./fetch-lot-bid-history.client";

const row = {
  id: "bid-1",
  lotId: "lot-1",
  bidderRef: "B12",
  amount: "120.00",
  isWinning: true,
  isAutoBid: true,
  placedVia: "web",
  createdAt: "2026-11-13T10:00:00.000Z",
};

describe("fetchLotBidHistory", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("reads each row and maps it for the feed", async () => {
    get.mockResolvedValue({ ok: true, json: async () => ({ data: [row] }) });
    await expect(fetchLotBidHistory("lot-1")).resolves.toEqual([
      {
        id: "bid-1",
        bidderId: "B12",
        amount: "120.00",
        at: Date.parse("2026-11-13T10:00:00.000Z"),
        isAutoBid: true,
        placedVia: "web",
      },
    ]);
    expect(get).toHaveBeenCalledWith({ param: { id: "lot-1" }, query: { limit: "30" } });
  });

  it("returns null when the body holds no rows", async () => {
    get.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(fetchLotBidHistory("lot-1")).resolves.toBeNull();
  });

  it("returns null when the request fails", async () => {
    get.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchLotBidHistory("lot-1")).resolves.toBeNull();
  });
});
