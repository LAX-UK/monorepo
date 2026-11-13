import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/data/http/hc-browser", () => ({
  getBrowserHc: () => ({ lots: { ":id": { $get: get } } }),
}));

import { fetchLotBidSnapshot } from "./fetch-lot-bid-snapshot.client";

const lot = {
  id: "lot-1",
  saleId: "sale-1",
  title: "A painting",
  status: "active",
  currentPrice: "1200.00",
  startingPrice: "1000.00",
  endTime: "2026-11-20T18:00:00.000Z",
  winnerId: null,
  hasReserve: true,
  reserveMet: false,
};

describe("fetchLotBidSnapshot", () => {
  // The lot schema is fetched alongside the request; load it once so the first test does not wait
  // on transforming it.
  beforeAll(async () => {
    await import("@/lib/data/http/lot.schema");
  }, 30_000);
  beforeEach(() => {
    get.mockReset();
  });

  it("reads the live fields through the public lot schema", async () => {
    get.mockResolvedValue({ ok: true, json: async () => ({ data: lot }) });
    const { parsePublicLotViewSchema } = await import("@/lib/data/http/lot.schema");
    const parsed = parsePublicLotViewSchema(lot);
    await expect(fetchLotBidSnapshot("lot-1")).resolves.toEqual({
      currentPrice: parsed.currentPrice,
      endTime: parsed.endTime,
      status: parsed.status,
      winnerId: parsed.winnerId,
      reserveMet: false,
    });
    expect(get).toHaveBeenCalledWith({ param: { id: "lot-1" } });
  });

  it("returns null when the request fails", async () => {
    get.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchLotBidSnapshot("lot-1")).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    get.mockImplementation(async () => {
      throw new Error("offline");
    });
    await expect(fetchLotBidSnapshot("lot-1")).resolves.toBeNull();
  });
});
