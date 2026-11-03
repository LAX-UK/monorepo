import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  UNSOLD_CHOICE_CONFIRMED_EVENT,
  UNSOLD_FOLLOW_UP_PROJECTOR,
  UnsoldFollowUpOpener,
  processUnsoldFollowUp,
} from "./unsold-follow-up.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function makeCtx(
  rows: Array<{ id: number; eventType: string; aggregateId: string; payload: unknown }>,
  failure: { action: "retry" | "skip" } = { action: "retry" },
): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(0),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn().mockResolvedValue(rows),
      getById: vi.fn(),
      listLockedForProjector: vi.fn(),
    },
    projectorFailureRecorder: { record: vi.fn().mockResolvedValue({ ...failure, failures: 1 }) },
  } as unknown as ProjectorRunContext;
}

const confirmed = (id: number, submissionId: string, lotId: string) => ({
  id,
  eventType: UNSOLD_CHOICE_CONFIRMED_EVENT,
  aggregateId: submissionId,
  payload: { submissionId, lotId, choice: "relist", reserve: "4200.00" },
});

describe("processUnsoldFollowUp", () => {
  it("reads only confirmed-choice events and opens the work for each", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx([confirmed(10, "s1", "l1"), confirmed(11, "s2", "l2")]);
    await processUnsoldFollowUp({ ctx, log, opener: { open } });
    expect(ctx.domainEventReader.listAfterCursor).toHaveBeenCalledWith(0, {
      eventTypes: [UNSOLD_CHOICE_CONFIRMED_EVENT],
      limit: 50,
    });
    expect(open).toHaveBeenNthCalledWith(1, "s1", "l1");
    expect(open).toHaveBeenNthCalledWith(2, "s2", "l2");
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      UNSOLD_FOLLOW_UP_PROJECTOR,
      11,
    );
  });

  it("skips an event without ids and moves on", async () => {
    const open = vi.fn();
    const ctx = makeCtx([
      { id: 5, eventType: UNSOLD_CHOICE_CONFIRMED_EVENT, aggregateId: "s", payload: {} },
    ]);
    await processUnsoldFollowUp({ ctx, log, opener: { open } });
    expect(open).not.toHaveBeenCalled();
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      UNSOLD_FOLLOW_UP_PROJECTOR,
      5,
    );
  });

  it("keeps the events it finished and retries from the one that failed", async () => {
    const open = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("db down"));
    const ctx = makeCtx([
      confirmed(10, "s1", "l1"),
      confirmed(11, "s2", "l2"),
      confirmed(12, "s3", "l3"),
    ]);
    await processUnsoldFollowUp({ ctx, log, opener: { open } });
    expect(open).toHaveBeenCalledTimes(2);
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      UNSOLD_FOLLOW_UP_PROJECTOR,
      10,
    );
  });

  it("moves past an event the failure policy gives up on", async () => {
    const open = vi.fn().mockRejectedValue(new Error("bad row"));
    const ctx = makeCtx([confirmed(10, "s1", "l1")], { action: "skip" });
    await processUnsoldFollowUp({ ctx, log, opener: { open } });
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      UNSOLD_FOLLOW_UP_PROJECTOR,
      10,
    );
  });

  it("does nothing when there are no events", async () => {
    const ctx = makeCtx([]);
    await processUnsoldFollowUp({ ctx, log, opener: { open: vi.fn() } });
    expect(ctx.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
  });
});

describe("UnsoldFollowUpOpener", () => {
  it("opens the work through the store", async () => {
    const openForConfirmedChoice = vi.fn().mockResolvedValue(null);
    await new UnsoldFollowUpOpener({ openForConfirmedChoice }).open("s1", "l1");
    expect(openForConfirmedChoice).toHaveBeenCalledWith("s1", "l1");
  });
});
