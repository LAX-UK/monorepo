import { beforeEach, describe, expect, it, vi } from "vitest";

const container = {
  session: { getCurrent: vi.fn() },
  bids: { listMine: vi.fn() },
};

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => container,
}));
vi.mock("@/lib/data/sale-titles.server", () => ({
  resolveSaleTitles: async () => ({ "sale-1": "The First Hammer" }),
}));

import { GET } from "./route";

describe("GET /bids/export", () => {
  beforeEach(() => {
    container.session.getCurrent.mockResolvedValue({ id: "me" });
    container.bids.listMine.mockResolvedValue([
      {
        bid: {
          id: "b1",
          lotId: "l1",
          amount: "900",
          maxAutoBidAmount: null,
          isWinning: true,
          isAutoBid: false,
          createdAt: new Date(),
        },
        lot: {
          id: "l1",
          saleId: "sale-1",
          lotNumber: 3,
          title: "Harbour",
          currentPrice: "900",
          status: "ended",
          winnerId: "me",
          endTime: new Date("2026-06-19T18:00:00Z"),
        },
      },
    ]);
  });

  it("downloads the requested view as CSV", async () => {
    const res = await GET(new Request("https://lax.bid/bids/export?tab=won"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/lax-bids-won-\d{4}-\d{2}-\d{2}\.csv/);
    const body = await res.text();
    expect(body).toContain("3,Harbour,The First Hammer,Won,900,900");
  });

  it("refuses a signed-out request", async () => {
    container.session.getCurrent.mockResolvedValue(null);
    const res = await GET(new Request("https://lax.bid/bids/export"));
    expect(res.status).toBe(401);
  });
});
