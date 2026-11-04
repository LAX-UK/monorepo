import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  BID_ALERT_MATCHING_PROJECTOR,
  processBidAlertMatching,
  salePublishedEvent,
} from "./bid-alert-matching.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = { warn: vi.fn(), info: vi.fn() } as unknown as pino.Logger;

type Row = {
  id: number;
  aggregateId: string;
  payload: unknown;
  eventType?: string;
  occurredAt?: Date;
};

function setup(input: Row[], cursor = 10) {
  const rows = input.map((row) => ({ eventType: "sale.published", ...row }));
  const advanceCursor = vi.fn();
  const record = vi.fn().mockResolvedValue({ action: "retry" });
  const ctx = {
    projectorStateRepo: { getCursor: vi.fn().mockResolvedValue(cursor), advanceCursor },
    domainEventReader: { listAfterCursor: vi.fn().mockResolvedValue(rows) },
    projectorFailureRecorder: { record },
  } as unknown as ProjectorRunContext;
  return { ctx, advanceCursor, record };
}

describe("salePublishedEvent", () => {
  it("announces unless the event says staff unticked the box", () => {
    expect(salePublishedEvent({ aggregateId: "s", payload: { lotCount: 4 } })).toEqual({
      saleId: "s",
      announce: true,
      lotCount: 4,
    });
    expect(salePublishedEvent({ aggregateId: "s", payload: { announce: false } })).toEqual({
      saleId: "s",
      announce: false,
      lotCount: null,
    });
    expect(salePublishedEvent({ aggregateId: "s", payload: null }).announce).toBe(true);
  });
});

describe("processBidAlertMatching", () => {
  it("does nothing until the first-run seed has run", async () => {
    const { ctx, advanceCursor } = setup([{ id: 11, aggregateId: "s1", payload: {} }]);
    const handle = vi.fn();
    await processBidAlertMatching({
      ctx,
      log,
      matching: {
        isSeeded: async () => false,
        lotStart: async () => 0,
        handle,
        handleLots: vi.fn(),
      },
    });
    expect(handle).not.toHaveBeenCalled();
    expect(advanceCursor).not.toHaveBeenCalled();
  });

  it("handles each published sale in order and moves the cursor to the last", async () => {
    const { ctx, advanceCursor } = setup([
      { id: 11, aggregateId: "s1", payload: { lotCount: 2 } },
      { id: 12, aggregateId: "s2", payload: { announce: false } },
    ]);
    const handle = vi.fn().mockResolvedValue("announced");
    await processBidAlertMatching({
      ctx,
      log,
      matching: {
        isSeeded: async () => true,
        lotStart: async () => 0,
        handle,
        handleLots: vi.fn(),
      },
    });
    expect(handle.mock.calls.map((c) => c[0].saleId)).toEqual(["s1", "s2"]);
    expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 12);
  });

  it("stops at a failure that is to be retried, keeping earlier progress", async () => {
    const { ctx, advanceCursor } = setup([
      { id: 11, aggregateId: "s1", payload: {} },
      { id: 12, aggregateId: "s2", payload: {} },
      { id: 13, aggregateId: "s3", payload: {} },
    ]);
    const handle = vi
      .fn()
      .mockResolvedValueOnce("announced")
      .mockRejectedValueOnce(new Error("db down"));
    await processBidAlertMatching({
      ctx,
      log,
      matching: {
        isSeeded: async () => true,
        lotStart: async () => 0,
        handle,
        handleLots: vi.fn(),
      },
    });
    expect(handle).toHaveBeenCalledTimes(2);
    expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 11);
  });

  it("skips past an event the failure recorder gives up on", async () => {
    const { ctx, advanceCursor, record } = setup([{ id: 11, aggregateId: "s1", payload: {} }]);
    record.mockResolvedValue({ action: "skip" });
    const handle = vi.fn().mockRejectedValue(new Error("bad"));
    await processBidAlertMatching({
      ctx,
      log,
      matching: {
        isSeeded: async () => true,
        lotStart: async () => 0,
        handle,
        handleLots: vi.fn(),
      },
    });
    expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 11);
  });

  describe("published lots", () => {
    const lotRow = (id: number, lotId: string, occurredAt = new Date()): Row => ({
      id,
      aggregateId: lotId,
      payload: {},
      eventType: "lot.published",
      occurredAt,
    });
    const run = (rows: Row[], handleLots: ReturnType<typeof vi.fn>, handle = vi.fn()) => {
      const s = setup(rows);
      return processBidAlertMatching({
        ctx: s.ctx,
        log,
        matching: { isSeeded: async () => true, lotStart: async () => 0, handle, handleLots },
      }).then(() => s);
    };

    it("matches lots published together in one batch", async () => {
      const handleLots = vi.fn().mockResolvedValue({});
      const { advanceCursor } = await run(
        [lotRow(11, "a"), lotRow(12, "b"), lotRow(13, "c")],
        handleLots,
      );
      expect(handleLots).toHaveBeenCalledTimes(1);
      expect(handleLots.mock.calls[0]?.[0]).toEqual([
        { lotId: "a" },
        { lotId: "b" },
        { lotId: "c" },
      ]);
      expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 13);
    });

    it("keeps event order around a sale", async () => {
      const calls: string[] = [];
      const handleLots = vi.fn(async (e: { lotId: string }[]) => {
        calls.push(`lots:${e.map((x) => x.lotId).join(",")}`);
      });
      const handle = vi.fn(async () => {
        calls.push("sale");
      });
      await run(
        [lotRow(11, "a"), { id: 12, aggregateId: "s", payload: {} }, lotRow(13, "b")],
        handleLots,
        handle,
      );
      expect(calls).toEqual(["lots:a", "sale", "lots:b"]);
    });

    it("matches every lot after the start point, however old the event is", async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
      const handleLots = vi.fn().mockResolvedValue({});
      const s = setup([lotRow(11, "a", weekAgo), lotRow(12, "b", weekAgo)]);
      await processBidAlertMatching({
        ctx: s.ctx,
        log,
        matching: {
          isSeeded: async () => true,
          lotStart: async () => 10,
          handle: vi.fn(),
          handleLots,
        },
      });
      expect(handleLots.mock.calls[0]?.[0]).toEqual([{ lotId: "a" }, { lotId: "b" }]);
      expect(s.advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 12);
    });

    it("moves past lot events from before the start point without matching them", async () => {
      const handleLots = vi.fn().mockResolvedValue({});
      const s = setup([lotRow(11, "old"), lotRow(12, "old2"), lotRow(13, "new")]);
      await processBidAlertMatching({
        ctx: s.ctx,
        log,
        matching: {
          isSeeded: async () => true,
          lotStart: async () => 12,
          handle: vi.fn(),
          handleLots,
        },
      });
      expect(handleLots.mock.calls.map((c) => c[0])).toEqual([[{ lotId: "new" }]]);
      expect(s.advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 13);
    });

    it("moves the cursor past a run that is all before the start point", async () => {
      const handleLots = vi.fn();
      const s = setup([lotRow(11, "old"), lotRow(12, "old2")]);
      await processBidAlertMatching({
        ctx: s.ctx,
        log,
        matching: {
          isSeeded: async () => true,
          lotStart: async () => 50,
          handle: vi.fn(),
          handleLots,
        },
      });
      expect(handleLots).not.toHaveBeenCalled();
      expect(s.advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 12);
    });

    it("falls back to one lot at a time when the batch fails, so one bad lot holds nothing", async () => {
      const handleLots = vi.fn(async (e: { lotId: string }[]) => {
        if (e.length > 1 || e[0]?.lotId === "bad") throw new Error("boom");
      });
      const s = setup([lotRow(11, "a"), lotRow(12, "bad"), lotRow(13, "c")]);
      s.record.mockResolvedValue({ action: "skip" });
      await processBidAlertMatching({
        ctx: s.ctx,
        log,
        matching: {
          isSeeded: async () => true,
          lotStart: async () => 0,
          handle: vi.fn(),
          handleLots,
        },
      });
      expect(handleLots.mock.calls.map((c) => c[0].map((x: { lotId: string }) => x.lotId))).toEqual(
        [["a", "bad", "c"], ["a"], ["bad"], ["c"]],
      );
      expect(s.advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 13);
    });

    it("stops at a lot that is to be retried, keeping what came before", async () => {
      const handleLots = vi.fn(async (e: { lotId: string }[]) => {
        if (e.length > 1 || e[0]?.lotId === "b") throw new Error("db down");
      });
      const { advanceCursor } = await run(
        [lotRow(11, "a"), lotRow(12, "b"), lotRow(13, "c")],
        handleLots,
      );
      expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 11);
    });
  });
});
