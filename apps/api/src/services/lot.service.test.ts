import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import { LotService } from "./lot.service.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000c0";

const baseLot: Lot = {
  id: lotId,
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "T",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId,
  auctionType: "english",
  startingPrice: "1",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "1",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: { artistNote: "x" },
};

function createSut(overrides: { lot?: Partial<Lot> } = {}) {
  const lot: Lot = { ...baseLot, ...overrides.lot };
  const findById = vi.fn().mockResolvedValue(lot);
  const updateMarketingDetails = vi
    .fn()
    .mockImplementation(async () => ({ ...lot, marketingDetails: { ...lot.marketingDetails, artistNote: "y" } }));
  const lotRepo: ILotRepository = {
    findById,
    updateMarketingDetails,
  } as unknown as ILotRepository;
  const bids = {} as unknown as IBidRepository;
  const watchlist = {} as unknown as IWatchlistRepository;
  const svc = new LotService(lotRepo, bids, watchlist, null, null);
  return { svc, findById, updateMarketingDetails };
}

describe("LotService.updateMarketingDetails", () => {
  it("returns 403 for non-admin", async () => {
    const { svc, findById, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails("client", lotId, { artistNote: "z" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AuthzError);
    expect(findById).not.toHaveBeenCalled();
    expect(updateMarketingDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when lot missing", async () => {
    const { svc, findById } = createSut({});
    findById.mockResolvedValueOnce(null);
    const r = await svc.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r.isErr()).toBe(true);
    if (r.isErr() && r.error instanceof LotError) {
      expect(r.error.status).toBe(404);
    }
  });

  it("returns 400 for ended or cancelled", async () => {
    const { svc: s1 } = createSut({ lot: { status: "ended" } });
    const r1 = await s1.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r1.isErr()).toBe(true);

    const { svc: s2 } = createSut({ lot: { status: "cancelled" } });
    const r2 = await s2.updateMarketingDetails("administrator", lotId, { artistNote: "z" });
    expect(r2.isErr()).toBe(true);
  });

  it("updates via repo for admin and allowed status", async () => {
    const { svc, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails("administrator", lotId, { artistNote: "new" });
    expect(r.isOk()).toBe(true);
    expect(updateMarketingDetails).toHaveBeenCalledWith(lotId, { artistNote: "new" });
  });
});
