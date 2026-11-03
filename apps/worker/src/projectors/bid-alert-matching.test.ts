import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  BID_ALERT_MATCHING_PROJECTOR,
  processBidAlertMatching,
  salePublishedEvent,
} from "./bid-alert-matching.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = { warn: vi.fn(), info: vi.fn() } as unknown as pino.Logger;

function setup(rows: { id: number; aggregateId: string; payload: unknown }[], cursor = 10) {
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
    await processBidAlertMatching({ ctx, log, matching: { isSeeded: async () => false, handle } });
    expect(handle).not.toHaveBeenCalled();
    expect(advanceCursor).not.toHaveBeenCalled();
  });

  it("handles each published sale in order and moves the cursor to the last", async () => {
    const { ctx, advanceCursor } = setup([
      { id: 11, aggregateId: "s1", payload: { lotCount: 2 } },
      { id: 12, aggregateId: "s2", payload: { announce: false } },
    ]);
    const handle = vi.fn().mockResolvedValue("announced");
    await processBidAlertMatching({ ctx, log, matching: { isSeeded: async () => true, handle } });
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
    await processBidAlertMatching({ ctx, log, matching: { isSeeded: async () => true, handle } });
    expect(handle).toHaveBeenCalledTimes(2);
    expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 11);
  });

  it("skips past an event the failure recorder gives up on", async () => {
    const { ctx, advanceCursor, record } = setup([{ id: 11, aggregateId: "s1", payload: {} }]);
    record.mockResolvedValue({ action: "skip" });
    const handle = vi.fn().mockRejectedValue(new Error("bad"));
    await processBidAlertMatching({ ctx, log, matching: { isSeeded: async () => true, handle } });
    expect(advanceCursor).toHaveBeenCalledWith(BID_ALERT_MATCHING_PROJECTOR, 11);
  });
});
