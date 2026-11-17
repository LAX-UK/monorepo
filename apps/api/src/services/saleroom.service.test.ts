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
    clearCurrentLotIfCurrent: vi.fn().mockResolvedValue({ cleared: true }),
    markEnded: vi.fn(),
    clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: false }),
    appendEvent: vi.fn(),
    listRecentEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

type OutcomeOpts = { inOutcomeTransaction: (tx: never) => Promise<void> };

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
      finalizeActiveLotFromClerkHammer: vi.fn(async (_lotId: string, opts: OutcomeOpts) => {
        await opts.inOutcomeTransaction({} as never);
        return { lotId: "lot-1" };
      }),
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
    expect(sessionRepo.clearCurrentLotIfCurrent).toHaveBeenCalledWith(
      { sessionId: "session-1", lotId: "lot-1" },
      expect.anything(),
    );
    expect(displayPublisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
  });
});

describe("SaleroomService lot outcome names the lot", () => {
  function liveOn(currentLotId: string | null) {
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn().mockResolvedValue({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId,
      }),
      clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: true }),
    });
    const lotLifecycle = {
      finalizeActiveLotFromClerkHammer: vi
        .fn()
        .mockResolvedValue({ winnerId: null, voided: false }),
      noSaleEndActiveLotFromClerk: vi.fn().mockResolvedValue({ lotId: "lot-1" }),
    };
    const lotJobs = { cancelLotJobs: vi.fn().mockResolvedValue(undefined) };
    const { service } = createService({ sessionRepo, lotLifecycle, lotJobs });
    return { service, sessionRepo, lotLifecycle };
  }

  it("refuses a hammer for a lot that is no longer on the block, and ends nothing", async () => {
    const { service, sessionRepo, lotLifecycle } = liveOn("lot-2");

    const result = await service.hammerCurrentLot({
      saleId: "sale-1",
      actorUserId: "staff-1",
      lotId: "lot-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({
        message: "This lot is no longer on the block",
        status: 409,
        code: "lot_not_on_block",
      });
    }
    expect(lotLifecycle.finalizeActiveLotFromClerkHammer).not.toHaveBeenCalled();
    expect(sessionRepo.clearCurrentLotIfCurrent).not.toHaveBeenCalled();
  });

  it("refuses a pass once the lot has left the block", async () => {
    const { service, lotLifecycle } = liveOn(null);

    const result = await service.noSaleCurrentLot({
      saleId: "sale-1",
      actorUserId: "staff-1",
      lotId: "lot-1",
    });

    expect(result.isErr() && result.error.code).toBe("lot_not_on_block");
    expect(lotLifecycle.noSaleEndActiveLotFromClerk).not.toHaveBeenCalled();
  });

  it("hammers the lot it names when that lot is on the block", async () => {
    const { service, lotLifecycle } = liveOn("lot-1");

    const result = await service.hammerCurrentLot({
      saleId: "sale-1",
      actorUserId: "staff-1",
      lotId: "lot-1",
    });

    expect(result.isOk()).toBe(true);
    expect(lotLifecycle.finalizeActiveLotFromClerkHammer).toHaveBeenCalledWith("lot-1", {
      inOutcomeTransaction: expect.any(Function),
    });
  });
});

describe("SaleroomService lot outcome takes only its own lot off the block", () => {
  const OUTCOME_TX = { outcomeTx: true } as never;

  /**
   * A live room whose session row behaves like Postgres for the current lot: a compare-and-clear
   * only clears the lot it names. `beforeOutcome` runs inside finalize, before the outcome
   * transaction's write, to stage a concurrent advance.
   */
  function room(options: { beforeOutcome?: () => Promise<unknown> } = {}) {
    const state = { currentLotId: "lot-1" as string | null };
    const sessionRepo = mockSessionRepo({
      findBySaleId: vi.fn(async () => ({
        id: "session-1",
        saleId: "sale-1",
        status: "live",
        currentLotId: state.currentLotId,
      })) as never,
      setCurrentLot: vi.fn(async (_sessionId: string, lotId: string) => {
        state.currentLotId = lotId;
      }),
      clearCurrentLotIfCurrent: vi.fn(async ({ lotId }: { sessionId: string; lotId: string }) => {
        if (state.currentLotId !== lotId) return { cleared: false };
        state.currentLotId = null;
        return { cleared: true };
      }),
      clearDisplayOverlay: vi.fn().mockResolvedValue({ cleared: true }),
    });
    const finalize = async (_lotId: string, opts: OutcomeOpts) => {
      await options.beforeOutcome?.();
      await opts.inOutcomeTransaction(OUTCOME_TX);
    };
    const lotLifecycle = {
      finalizeActiveLotFromClerkHammer: vi.fn(async (lotId: string, opts: OutcomeOpts) => {
        await finalize(lotId, opts);
        return { winnerId: null, voided: false };
      }),
      noSaleEndActiveLotFromClerk: vi.fn(async (lotId: string, opts: OutcomeOpts) => {
        await finalize(lotId, opts);
        return true;
      }),
      processActivateJob: vi.fn(),
    };
    const lotRepo = {
      findById: vi.fn(async (id: string) => ({ id, saleId: "sale-1", status: "active" })),
      findRunOrderRefsBySaleId: vi.fn().mockResolvedValue([]),
    };
    const lotJobs = { cancelLotJobs: vi.fn().mockResolvedValue(undefined) };
    const { service, redisPublish } = createService({
      sessionRepo,
      lotLifecycle,
      lotRepo,
      lotJobs,
    });
    return { service, state, sessionRepo, redisPublish };
  }

  it("resolving the current lot clears it, in the outcome transaction", async () => {
    for (const resolve of ["hammerCurrentLot", "noSaleCurrentLot"] as const) {
      const { service, state, sessionRepo } = room();

      const result = await service[resolve]({
        saleId: "sale-1",
        actorUserId: "staff-1",
        lotId: "lot-1",
      });

      expect(result.isOk()).toBe(true);
      expect(state.currentLotId).toBeNull();
      expect(sessionRepo.clearCurrentLotIfCurrent).toHaveBeenCalledWith(
        { sessionId: "session-1", lotId: "lot-1" },
        OUTCOME_TX,
      );
      expect(sessionRepo.clearDisplayOverlay).toHaveBeenCalledWith("sale-1");
    }
  });

  it("resolving a lot that is no longer current leaves the current lot and its overlay", async () => {
    for (const resolve of ["hammerCurrentLot", "noSaleCurrentLot"] as const) {
      let advance: () => Promise<unknown> = async () => undefined;
      const { service, state, sessionRepo, redisPublish } = room({
        beforeOutcome: () => advance(),
      });
      advance = () =>
        service.advanceToLot({ saleId: "sale-1", lotId: "lot-2", actorUserId: "staff-2" });

      // The session read still saw lot-1; lot-2 goes up before the outcome is written.
      const result = await service[resolve]({ saleId: "sale-1", actorUserId: "staff-1" });

      expect(result.isOk() && result.value).toEqual({ lotId: "lot-1" });
      expect(state.currentLotId).toBe("lot-2");
      // Only the advance cleared the overlay; the late outcome did not clear lot-2's.
      expect(sessionRepo.clearDisplayOverlay).toHaveBeenCalledTimes(1);
      // The outcome itself is still recorded for lot-1.
      const outcomeEvents = redisPublish.mock.calls
        .map(([, body]) => JSON.parse(body as string) as { kind: string; lotId?: string })
        .filter((event) => event.kind === "hammer" || event.kind === "no_sale");
      expect(outcomeEvents).toEqual([expect.objectContaining({ lotId: "lot-1" })]);
    }
  });

  it("a resolve and next-lot racing each other always leave the next lot on the block", async () => {
    // Resolve first, then advance.
    {
      const { service, state } = room();
      await service.hammerCurrentLot({ saleId: "sale-1", actorUserId: "staff-1", lotId: "lot-1" });
      await service.advanceToLot({ saleId: "sale-1", lotId: "lot-2", actorUserId: "staff-1" });
      expect(state.currentLotId).toBe("lot-2");
    }
    // Both in flight at once: the advance lands while the hammer is finalising.
    {
      let releaseOutcome: () => void = () => undefined;
      const outcomeGate = new Promise<void>((resolve) => {
        releaseOutcome = resolve;
      });
      const { service, state } = room({ beforeOutcome: () => outcomeGate });

      const hammer = service.hammerCurrentLot({
        saleId: "sale-1",
        actorUserId: "staff-1",
        lotId: "lot-1",
      });
      const advance = service.advanceToLot({
        saleId: "sale-1",
        lotId: "lot-2",
        actorUserId: "staff-2",
      });
      await advance;
      releaseOutcome();
      const [hammered, advanced] = await Promise.all([hammer, advance]);

      expect(hammered.isOk()).toBe(true);
      expect(advanced.isOk()).toBe(true);
      expect(state.currentLotId).toBe("lot-2");
    }
  });
});

describe("SaleroomService.getLotSnapshot", () => {
  it("returns the lot's price and reserve, only for a lot in the sale", async () => {
    const lotRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "lot-1",
        saleId: "sale-1",
        status: "active",
        currentPrice: "950.00",
        reservePrice: "900.00",
      }),
    };
    const { service } = createService({ lotRepo });

    await expect(service.getLotSnapshot("sale-1", "lot-1")).resolves.toEqual({
      lotId: "lot-1",
      status: "active",
      currentPrice: "950.00",
      reservePrice: "900.00",
    });
    await expect(service.getLotSnapshot("sale-2", "lot-1")).resolves.toBeNull();
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
