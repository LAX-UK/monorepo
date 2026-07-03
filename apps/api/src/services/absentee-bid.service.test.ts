import type { Database } from "@auction/db";
import { DrizzleAbsenteeBidRepository, type IAbsenteeBidRepository } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AbsenteeBidService } from "./absentee-bid.service.js";
import type { IBidPlacer } from "./interfaces/place-bid.js";
import type { ILotRepository } from "./interfaces/repositories.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-le",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date(now.getTime() + 86_400_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

describe("AbsenteeBidService", () => {
  it("rejects schedule when lot is not scheduled or active", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(mkLot({ status: "ended" })),
    } as unknown as ILotRepository;
    const svc = new AbsenteeBidService(
      {} as IAbsenteeBidRepository,
      {} as IBidPlacer,
      lotRepo,
      null,
    );
    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.status).toBe(400);
  });

  it("returns 409 on duplicate scheduled absentee bid", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
    } as unknown as ILotRepository;
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue({ code: "23505" }),
        }),
      }),
    } as unknown as Database;
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      {} as IBidPlacer,
      lotRepo,
      null,
    );
    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(409);
      expect(result.error.code).toBe("absentee_duplicate");
    }
  });

  it("marks absentee lost when opening bid exceeds max", async () => {
    const activeLot = mkLot({ currentPrice: "200.00", minBidIncrement: "10.00" });
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(activeLot),
    } as unknown as ILotRepository;
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhere }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "abs-1",
                maxAmount: "205.00",
                userId: "u1",
                buyerLegalEntityId: "le-1",
                status: "scheduled",
              },
            ]),
          }),
        }),
      }),
    } as unknown as Database;
    const placeBid = vi.fn();
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      { placeBid } as unknown as IBidPlacer,
      lotRepo,
      null,
    );
    await svc.replayScheduledForLot("lot-1");
    expect(placeBid).not.toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalled();
  });

  it("executes absentee bid via placeBid with absentee placement", async () => {
    const activeLot = mkLot({ currentPrice: "100.00", minBidIncrement: "10.00" });
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(activeLot),
    } as unknown as ILotRepository;
    const db = {
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "abs-1" }]),
          })),
        }),
      })),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "abs-1",
                maxAmount: "500.00",
                userId: "u1",
                buyerLegalEntityId: "le-1",
                status: "scheduled",
              },
            ]),
          }),
        }),
      }),
    } as unknown as Database;
    const placeBid = vi.fn().mockResolvedValue(ok({ id: "bid-1" }));
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      { placeBid } as unknown as IBidPlacer,
      lotRepo,
      null,
    );
    await svc.replayScheduledForLot("lot-1");
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: "lot-1",
        amount: 110,
        maxAutoBidAmount: 500,
        placement: { placedVia: "absentee" },
      }),
    );
  });

  it("expireStaleExecutingLeases marks stale executing rows lost", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Database;
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      {} as IBidPlacer,
      { findById: vi.fn() } as unknown as ILotRepository,
      null,
    );
    await svc.expireStaleExecutingLeases();
    expect(where).toHaveBeenCalled();
  });
});
