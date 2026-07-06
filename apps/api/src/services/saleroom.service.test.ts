import type { ISaleroomSessionRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { SaleroomService } from "./saleroom.service.js";

function mockSessionRepo(
  overrides: Partial<ISaleroomSessionRepository> = {},
): ISaleroomSessionRepository {
  return {
    findBySaleId: vi.fn(),
    findStatusSummariesBySaleIds: vi.fn().mockResolvedValue([]),
    upsertPending: vi.fn(),
    markLive: vi.fn(),
    markPaused: vi.fn(),
    markResumed: vi.fn(),
    setCurrentLot: vi.fn(),
    clearCurrentLot: vi.fn(),
    markEnded: vi.fn(),
    clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: false }),
    appendEvent: vi.fn(),
    listRecentEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createService(
  overrides: {
    sessionRepo?: ISaleroomSessionRepository;
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
  const sessionRepo = overrides.sessionRepo ?? mockSessionRepo();

  return {
    service: new SaleroomService({
      sessionRepo,
      redis: mockDomainEventSink(redisPublish) as never,
      lotLifecycle: (overrides.lotLifecycle ?? {}) as never,
      saleRepo: (overrides.saleRepo ?? { findById: vi.fn() }) as never,
      lotRepo: (overrides.lotRepo ?? {
        findById: vi.fn(),
        findBySaleId: vi.fn().mockResolvedValue([]),
        findRunOrderRefsBySaleId: vi.fn().mockResolvedValue([]),
      }) as never,
      lotJobs: (overrides.lotJobs ?? null) as never,
      telephoneBidBookingService: (overrides.telephoneBidBookingService ?? null) as never,
      displayPublisher: displayPublisher as never,
    }),
    sessionRepo,
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
        allowOnlineBidsBeforeGoLive: false,
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
    const sessionRepo = mockSessionRepo({
      findStatusSummariesBySaleIds: vi.fn().mockResolvedValue([]),
    });
    const { service } = createService({ sessionRepo });

    const rows = await service.getSessionStatuses(["sale-a", "sale-b"]);
    expect(rows).toEqual([
      { saleId: "sale-a", status: "none", currentLotId: null },
      { saleId: "sale-b", status: "none", currentLotId: null },
    ]);
  });

  it("maps batched session rows in request order", async () => {
    const sessionRepo = mockSessionRepo({
      findStatusSummariesBySaleIds: vi
        .fn()
        .mockResolvedValue([{ saleId: "sale-b", status: "live", currentLotId: "lot-9" }]),
    });
    const { service } = createService({ sessionRepo });
    const rows = await service.getSessionStatuses(["sale-a", "sale-b"]);
    expect(rows).toEqual([
      { saleId: "sale-a", status: "none", currentLotId: null },
      { saleId: "sale-b", status: "live", currentLotId: "lot-9" },
    ]);
  });
});

describe("SaleroomService.pause", () => {
  it("publishes paused event when session is live", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: "lot-1",
      }),
    });

    const { service, redisPublish } = createService({ sessionRepo });

    const result = await service.pause({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    expect(sessionRepo.markPaused).toHaveBeenCalledWith("session-1");
    expect(sessionRepo.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "paused", sessionId: "session-1" }),
    );
    expect(redisPublish).toHaveBeenCalledWith(
      "sale:sale-1:saleroom",
      expect.stringContaining('"kind":"paused"'),
    );
  });

  it("rejects when session is not live", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "paused",
        currentLotId: null,
      }),
    });

    const { service } = createService({ sessionRepo });
    const result = await service.pause({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
    }
  });
});

describe("SaleroomService.advanceToLot", () => {
  it("clears display overlay and publishes advance event", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: null,
      }),
      clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: true }),
    });

    const lotRepo = {
      findById: vi.fn().mockResolvedValue({ id: "lot-2", saleId: "sale-1", status: "active" }),
      findBySaleId: vi.fn().mockResolvedValue([
        { id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" },
        { id: "lot-3", lotNumber: 3, title: "Lot 3", status: "scheduled" },
      ]),
      findRunOrderRefsBySaleId: vi.fn().mockResolvedValue([
        { id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" },
        { id: "lot-3", lotNumber: 3, title: "Lot 3", status: "scheduled" },
      ]),
    };

    const { service, redisPublish, displayPublisher } = createService({
      sessionRepo,
      lotRepo,
    });

    const result = await service.advanceToLot({
      saleId: "sale-1",
      lotId: "lot-2",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(sessionRepo.setCurrentLot).toHaveBeenCalledWith("session-1", "lot-2");
    expect(displayPublisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
    expect(redisPublish).toHaveBeenCalledWith(
      "sale:sale-1:saleroom",
      expect.stringContaining('"kind":"advanced_to_lot"'),
    );
    expect(redisPublish).toHaveBeenCalledWith(
      "sale:sale-1:saleroom",
      expect.stringContaining('"nextLotId":"lot-3"'),
    );
  });

  it("activates a scheduled lot before advancing", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: null,
      }),
    });

    const processActivateJob = vi.fn().mockResolvedValue(undefined);
    const lotRepo = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({ id: "lot-2", saleId: "sale-1", status: "scheduled" })
        .mockResolvedValueOnce({ id: "lot-2", saleId: "sale-1", status: "active" }),
      findBySaleId: vi
        .fn()
        .mockResolvedValue([{ id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" }]),
      findRunOrderRefsBySaleId: vi
        .fn()
        .mockResolvedValue([{ id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" }]),
    };

    const { service } = createService({
      sessionRepo,
      lotRepo,
      lotLifecycle: { processActivateJob },
    });

    const result = await service.advanceToLot({
      saleId: "sale-1",
      lotId: "lot-2",
      actorUserId: "staff-1",
    });

    expect(processActivateJob).toHaveBeenCalledWith("lot-2");
    expect(result.isOk()).toBe(true);
  });

  it("rejects ended lots", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: null,
      }),
    });

    const lotRepo = {
      findById: vi.fn().mockResolvedValue({ id: "lot-2", saleId: "sale-1", status: "ended" }),
      findBySaleId: vi
        .fn()
        .mockResolvedValue([{ id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" }]),
      findRunOrderRefsBySaleId: vi
        .fn()
        .mockResolvedValue([{ id: "lot-2", lotNumber: 2, title: "Lot 2", status: "active" }]),
    };

    const { service } = createService({ sessionRepo, lotRepo });
    const result = await service.advanceToLot({
      saleId: "sale-1",
      lotId: "lot-2",
      actorUserId: "staff-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("already closed");
    }
  });
});

describe("SaleroomService.hammerCurrentLot", () => {
  it("completes telephone lines and clears overlay", async () => {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: "lot-1",
      }),
      clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: true }),
    });

    const lotLifecycle = {
      finalizeActiveLotFromClerkHammer: vi.fn().mockResolvedValue({ lotId: "lot-1" }),
    };
    const lotJobs = { cancelLotJobs: vi.fn().mockResolvedValue(undefined) };
    const telephoneBidBookingService = {
      completeLinesForLot: vi.fn().mockResolvedValue(undefined),
    };

    const { service, displayPublisher } = createService({
      sessionRepo,
      lotLifecycle,
      lotJobs,
      telephoneBidBookingService,
    });

    const result = await service.hammerCurrentLot({ saleId: "sale-1", actorUserId: "staff-1" });
    expect(result.isOk()).toBe(true);
    expect(telephoneBidBookingService.completeLinesForLot).toHaveBeenCalledWith("sale-1", "lot-1");
    expect(sessionRepo.clearCurrentLot).toHaveBeenCalledWith("session-1");
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
