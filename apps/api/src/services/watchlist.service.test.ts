import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IWatchlistRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { WatchlistService } from "./watchlist.service.js";

const lotA = { id: "lot-a", status: "active", categoryIds: ["cat-1"] } as Lot;
const lotB = { id: "lot-b", status: "ended", categoryIds: ["cat-2"] } as Lot;

describe("WatchlistService.listWithLots", () => {
  it("loads lots in a single findByIds call", async () => {
    const findByIds = vi.fn().mockResolvedValue([lotA, lotB]);
    const lots: ILotRepository = {
      findByIds,
      findById: vi.fn(),
    } as unknown as ILotRepository;
    const watchlist: IWatchlistRepository = {
      findByUser: vi.fn().mockResolvedValue([
        { id: "w1", lotId: "lot-a", createdAt: new Date("2026-01-01") },
        { id: "w2", lotId: "lot-b", createdAt: new Date("2026-01-02") },
      ]),
    } as unknown as IWatchlistRepository;

    const service = new WatchlistService(
      watchlist,
      lots,
      { runInTransaction: async (fn) => fn({} as never) },
      { stage: vi.fn(), emit: vi.fn(), enqueue: vi.fn() },
    );
    const rows = await service.listWithLots("user-1");

    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(findByIds).toHaveBeenCalledWith(["lot-a", "lot-b"]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.lot?.id).sort()).toEqual(["lot-a", "lot-b"]);
  });
});

describe("WatchlistService.listWithLots price sorts", () => {
  const lot = (id: string, overrides: Partial<Lot>) =>
    ({
      id,
      status: "active",
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "100.00",
      ...overrides,
    }) as Lot;
  // The sealed lots' stored prices rank them opposite to their starting prices.
  const rows = [
    lot("sealed-high-bid", {
      auctionType: "sealed",
      startingPrice: "100.00",
      currentPrice: "9000.00",
    }),
    lot("sealed-low-bid", {
      auctionType: "sealed",
      startingPrice: "200.00",
      currentPrice: "300.00",
    }),
    lot("open", { currentPrice: "500.00" }),
  ];

  function service() {
    const lots = { findByIds: vi.fn().mockResolvedValue(rows) } as unknown as ILotRepository;
    const watchlist = {
      findByUser: vi
        .fn()
        .mockResolvedValue(
          rows.map((l, i) => ({ id: `w${i}`, lotId: l.id, createdAt: new Date(2026, 0, i + 1) })),
        ),
    } as unknown as IWatchlistRepository;
    return new WatchlistService(
      watchlist,
      lots,
      { runInTransaction: async (fn) => fn({} as never) },
      { stage: vi.fn(), emit: vi.fn(), enqueue: vi.fn() },
    );
  }

  it("sorts an open sealed lot by its starting price, not its hidden high bid", async () => {
    const asc = await service().listWithLots("user-1", { sort: "priceAsc" });
    expect(asc.map((r) => r.lotId)).toEqual(["sealed-high-bid", "sealed-low-bid", "open"]);
    const desc = await service().listWithLots("user-1", { sort: "priceDesc" });
    expect(desc.map((r) => r.lotId)).toEqual(["open", "sealed-low-bid", "sealed-high-bid"]);
  });
});
