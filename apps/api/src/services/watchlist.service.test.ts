import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
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
