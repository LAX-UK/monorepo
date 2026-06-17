import { describe, expect, it, vi } from "vitest";
import { SaleroomService } from "./saleroom.service.js";

function createService(
  overrides: {
    db?: Record<string, unknown>;
    redis?: { publish: ReturnType<typeof vi.fn> };
    displayPublisher?: { publishDisplayControl: ReturnType<typeof vi.fn> };
    lotLifecycle?: Record<string, ReturnType<typeof vi.fn>>;
    saleRepo?: Record<string, ReturnType<typeof vi.fn>>;
    lotRepo?: Record<string, ReturnType<typeof vi.fn>>;
    lotJobs?: Record<string, ReturnType<typeof vi.fn>> | null;
    telephoneBidBookingService?: Record<string, ReturnType<typeof vi.fn>> | null;
  } = {},
) {
  const redisPublish = overrides.redis?.publish ?? vi.fn().mockResolvedValue(undefined);
  const displayPublisher = overrides.displayPublisher ?? {
    publishDisplayControl: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new SaleroomService({
      db: (overrides.db ?? {}) as never,
      redis: { publish: redisPublish } as never,
      lotLifecycle: (overrides.lotLifecycle ?? {}) as never,
      saleRepo: (overrides.saleRepo ?? { findById: vi.fn() }) as never,
      lotRepo: (overrides.lotRepo ?? { findById: vi.fn(), findBySaleId: vi.fn() }) as never,
      lotJobs: (overrides.lotJobs ?? null) as never,
      telephoneBidBookingService: (overrides.telephoneBidBookingService ?? null) as never,
      displayPublisher: displayPublisher as never,
    }),
    redisPublish,
    displayPublisher,
  };
}

describe("SaleroomService.goLive", () => {
  it("rejects online sales", async () => {
    const saleRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "sale-online",
        deliveryMode: "online",
        status: "active",
      }),
    };
    const { service } = createService({ saleRepo });

    const result = await service.goLive({ saleId: "sale-online", actorUserId: "staff-1" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("onsite and hybrid");
    }
  });
});

describe("SaleroomService.getSessionStatuses", () => {
  it("returns none for sale ids without a session row", async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const { service } = createService({
      db: { select },
    });

    const rows = await service.getSessionStatuses(["sale-a", "sale-b"]);
    expect(rows).toEqual([
      { saleId: "sale-a", status: "none", currentLotId: null },
      { saleId: "sale-b", status: "none", currentLotId: null },
    ]);
  });

  it("maps batched session rows in request order", async () => {
    const where = vi
      .fn()
      .mockResolvedValue([{ saleId: "sale-b", status: "live", currentLotId: "lot-9" }]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const { service } = createService({ db: { select } });
    const rows = await service.getSessionStatuses(["sale-a", "sale-b"]);
    expect(rows).toEqual([
      { saleId: "sale-a", status: "none", currentLotId: null },
      { saleId: "sale-b", status: "live", currentLotId: "lot-9" },
    ]);
  });
});

describe("SaleroomService.pause", () => {
  it("publishes paused event when session is live", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue([
        { id: "session-1", saleId: "sale-1", status: "live", currentLotId: "lot-1" },
      ]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from: fromSelect });

    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });

    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });

    const { service, redisPublish } = createService({
      db: { select, update, insert },
    });

    const result = await service.pause({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    expect(redisPublish).toHaveBeenCalledWith(
      "sale:sale-1:saleroom",
      expect.stringContaining('"kind":"paused"'),
    );
  });

  it("rejects when session is not live", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue([
        { id: "session-1", saleId: "sale-1", status: "paused", currentLotId: null },
      ]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from: fromSelect });

    const { service } = createService({ db: { select } });
    const result = await service.pause({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
    }
  });
});

describe("SaleroomService.advanceToLot", () => {
  it("clears display overlay and publishes advance event", async () => {
    const session = {
      id: "session-1",
      saleId: "sale-1",
      status: "live",
      currentLotId: null,
      displayOverlay: { kind: "fair_warning", emittedAt: "2026-06-17T09:00:00.000Z" },
    };
    const limit = vi.fn().mockResolvedValue([session]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from: fromSelect });

    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const whereUpdate = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });

    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });

    const lotRepo = {
      findById: vi.fn().mockResolvedValue({ id: "lot-2", saleId: "sale-1" }),
      findBySaleId: vi.fn(),
    };

    const { service, redisPublish, displayPublisher } = createService({
      db: { select, update, insert },
      lotRepo,
    });

    const result = await service.advanceToLot({
      saleId: "sale-1",
      lotId: "lot-2",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(displayPublisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
    expect(redisPublish).toHaveBeenCalledWith(
      "sale:sale-1:saleroom",
      expect.stringContaining('"kind":"advanced_to_lot"'),
    );
  });
});

describe("SaleroomService.hammerCurrentLot", () => {
  it("completes telephone lines and clears overlay", async () => {
    const session = {
      id: "session-1",
      saleId: "sale-1",
      status: "live",
      currentLotId: "lot-1",
      displayOverlay: { kind: "announcement", emittedAt: "2026-06-17T09:00:00.000Z" },
    };
    const limit = vi.fn().mockResolvedValue([session]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from: fromSelect });

    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const whereUpdate = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });

    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });

    const lotLifecycle = {
      finalizeActiveLotFromClerkHammer: vi.fn().mockResolvedValue({ lotId: "lot-1" }),
    };
    const lotJobs = { cancelLotJobs: vi.fn().mockResolvedValue(undefined) };
    const telephoneBidBookingService = {
      completeLinesForLot: vi.fn().mockResolvedValue(undefined),
    };

    const { service, displayPublisher } = createService({
      db: { select, update, insert },
      lotLifecycle,
      lotJobs,
      telephoneBidBookingService,
    });

    const result = await service.hammerCurrentLot({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    expect(telephoneBidBookingService.completeLinesForLot).toHaveBeenCalledWith("sale-1", "lot-1");
    expect(displayPublisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
  });
});

describe("SaleroomService.publishClerkPaddleBidSummary", () => {
  it("publishes bid summary on display channel", async () => {
    const { service, displayPublisher } = createService();
    await service.publishClerkPaddleBidSummary({
      saleId: "sale-1",
      lotId: "lot-1",
      currentPrice: "250.00",
      bidCount: 3,
      leaderPaddleNumber: 205,
    });
    expect(displayPublisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({
        kind: "bid_summary",
        lotId: "lot-1",
        currentPrice: "250.00",
        bidCount: 3,
        leaderPaddleNumber: 205,
      }),
    );
  });
});
