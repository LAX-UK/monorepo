import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AbsenteeBidService, absenteePlacementKey } from "./absentee-bid.service.js";

describe("absentee durable placement replay", () => {
  it("finalizes executing row when bid already exists for placement key", async () => {
    const absenteeId = "00000000-0000-4000-8000-000000000001";
    const lotId = "00000000-0000-4000-8000-000000000002";
    const bidId = "00000000-0000-4000-8000-000000000003";
    const placementKey = absenteePlacementKey(absenteeId);

    const absenteeBidRepo = {
      insertScheduled: vi.fn(),
      expireStaleExecutingLeases: vi.fn(),
      listStaleExecuting: vi.fn(async () => []),
      listScheduledForLot: vi.fn(async () => [
        {
          id: absenteeId,
          lotId,
          userId: "user-1",
          buyerLegalEntityId: "le-1",
          maxAmount: "100.00",
          status: "scheduled",
        },
      ]),
      markVoided: vi.fn(),
      markLost: vi.fn(),
      claimExecuting: vi.fn(async () => false),
      markExecuted: vi.fn(),
    };

    const lotRepo = {
      findById: vi.fn(async () => ({
        id: lotId,
        status: "active",
        currentPrice: "10.00",
        minBidIncrement: "1.00",
      })),
    };

    const bidRepo = {
      findByInternalPlacementKey: vi.fn(async (key: string) =>
        key === placementKey ? { id: bidId } : null,
      ),
    };

    const bidPlacer = { placeBid: vi.fn() };

    const svc = new AbsenteeBidService(
      absenteeBidRepo as never,
      bidPlacer as never,
      lotRepo as never,
      null,
      bidRepo as never,
    );

    await svc.replayScheduledForLot(lotId);

    expect(bidPlacer.placeBid).not.toHaveBeenCalled();
    expect(absenteeBidRepo.markExecuted).toHaveBeenCalledWith(absenteeId, bidId);
  });

  it("reconciles stale executing lease via placement key instead of blind lost", async () => {
    const absenteeId = "00000000-0000-4000-8000-000000000004";
    const bidId = "00000000-0000-4000-8000-000000000005";

    const absenteeBidRepo = {
      insertScheduled: vi.fn(),
      expireStaleExecutingLeases: vi.fn(),
      listStaleExecuting: vi.fn(async () => [{ id: absenteeId, status: "executing" }]),
      listScheduledForLot: vi.fn(async () => []),
      markVoided: vi.fn(),
      markLost: vi.fn(),
      claimExecuting: vi.fn(),
      markExecuted: vi.fn(),
    };

    const bidRepo = {
      findByInternalPlacementKey: vi.fn(async () => ({ id: bidId })),
    };

    const svc = new AbsenteeBidService(
      absenteeBidRepo as never,
      { placeBid: vi.fn(async () => ok({ id: bidId })) } as never,
      { findById: vi.fn() } as never,
      null,
      bidRepo as never,
    );

    await svc.expireStaleExecutingLeases();

    expect(absenteeBidRepo.expireStaleExecutingLeases).not.toHaveBeenCalled();
    expect(absenteeBidRepo.markExecuted).toHaveBeenCalledWith(absenteeId, bidId);
  });
});
