import type { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import type { LotRegisterLink } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  ARTWORK_OFFER_LOCK_PROJECTOR,
  BidOfferLockRecorder,
  bidOfferMove,
  processArtworkOfferLock,
} from "./artwork-offer-lock.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function link(over: Partial<LotRegisterLink> = {}): LotRegisterLink {
  return { registerId: "reg-1", status: "draft", hasWinner: false, soldOnAtg: false, ...over };
}

describe("bidOfferMove", () => {
  const unpublished = { eventType: "lot.unpublished", aggregateId: "lot-1", payload: {} };

  it("withdraws a lot that is draft, cancelled, voided or ended with no winner", () => {
    for (const status of ["draft", "cancelled", "voided"] as const) {
      expect(bidOfferMove(unpublished, link({ status }))).toEqual({
        kind: "withdraw",
        lotId: "lot-1",
      });
    }
    expect(bidOfferMove(unpublished, link({ status: "ended", hasWinner: false }))?.kind).toBe(
      "withdraw",
    );
  });

  it("leaves a lot that is live, scheduled or won offered, whatever the event's age", () => {
    for (const status of ["scheduled", "active"] as const) {
      expect(bidOfferMove(unpublished, link({ status }))).toBeNull();
    }
    expect(bidOfferMove(unpublished, link({ status: "ended", hasWinner: true }))).toBeNull();
  });

  it("completes the sale of the lot a captured payment names", () => {
    const captured = {
      eventType: "payment.captured",
      aggregateId: "pay-1",
      payload: { lotId: "lot-9" },
    };
    expect(bidOfferMove(captured, link({ status: "ended", hasWinner: true }))).toEqual({
      kind: "sold",
      lotId: "lot-9",
    });
    expect(bidOfferMove({ ...captured, payload: {} }, link())).toBeNull();
  });

  it("does nothing for a lot with no register link", () => {
    expect(bidOfferMove(unpublished, null)).toBeNull();
  });
});

describe("BidOfferLockRecorder", () => {
  function setup(found: LotRegisterLink | null) {
    const lock = {
      withdraw: vi.fn().mockResolvedValue({ status: "moved" }),
      markSold: vi.fn().mockResolvedValue({ status: "moved" }),
    };
    const recorder = new BidOfferLockRecorder(lock as unknown as ArtworkOfferLock, {
      findLink: vi.fn().mockResolvedValue(found),
    });
    return { lock, recorder };
  }

  it("withdraws the lot's offer when the lot is no longer offered", async () => {
    const { lock, recorder } = setup(link({ status: "cancelled" }));
    await recorder.apply({ eventType: "lot.cancelled", aggregateId: "lot-1", payload: {} });
    expect(lock.withdraw).toHaveBeenCalledWith(
      { registerId: "reg-1" },
      { kind: "bid_lot", id: "lot-1" },
      "system",
    );
  });

  it("marks the artwork sold when the lot's payment is captured", async () => {
    const { lock, recorder } = setup(link({ status: "ended", hasWinner: true }));
    await recorder.apply({
      eventType: "payment.captured",
      aggregateId: "pay-1",
      payload: { lotId: "lot-1" },
    });
    expect(lock.markSold).toHaveBeenCalledWith(
      { registerId: "reg-1" },
      { kind: "bid_lot", id: "lot-1" },
      "system",
    );
  });

  it("ignores a lot with no register link", async () => {
    const { lock, recorder } = setup(null);
    const outcome = await recorder.apply({
      eventType: "lot.ended",
      aggregateId: "lot-1",
      payload: { outcome: "no_sale" },
    });
    expect(outcome).toEqual({ status: "ignored" });
    expect(lock.withdraw).not.toHaveBeenCalled();
  });
});

function makeCtx(
  rows: Array<{ id: number; eventType: string; aggregateId: string; payload: unknown }>,
): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(5),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn().mockResolvedValue(rows),
      getById: vi.fn(),
      listLockedForProjector: vi.fn(),
    },
    projectorFailureRecorder: {
      record: vi.fn().mockResolvedValue({ action: "retry", failures: 1 }),
    },
  } as unknown as ProjectorRunContext;
}

describe("processArtworkOfferLock", () => {
  const row = (id: number) => ({
    id,
    eventType: "lot.cancelled",
    aggregateId: `lot-${id}`,
    payload: {},
  });

  it("applies each event and moves the cursor past them", async () => {
    const apply = vi.fn().mockResolvedValue({ status: "moved" });
    const ctx = makeCtx([row(6), row(7)]);
    await processArtworkOfferLock({ ctx, log, recorder: { apply } });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      ARTWORK_OFFER_LOCK_PROJECTOR,
      7,
    );
  });

  it("keeps what was done and retries from the failed event", async () => {
    const apply = vi
      .fn()
      .mockResolvedValueOnce({ status: "moved" })
      .mockRejectedValueOnce(new Error("register unavailable"));
    const ctx = makeCtx([row(6), row(7), row(8)]);
    await processArtworkOfferLock({ ctx, log, recorder: { apply } });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      ARTWORK_OFFER_LOCK_PROJECTOR,
      6,
    );
  });
});

describe("bidOfferMove for a lot ATG sold", () => {
  const ended = { eventType: "lot.ended", aggregateId: "lot-1", payload: {} };

  it("treats an ended lot with no LAX winner that ATG sold as sold, not withdrawn", () => {
    expect(bidOfferMove(ended, link({ status: "ended", soldOnAtg: true }))).toEqual({
      kind: "sold",
      lotId: "lot-1",
    });
  });

  it("still withdraws an ended lot ATG did not sell", () => {
    expect(bidOfferMove(ended, link({ status: "ended", soldOnAtg: false }))?.kind).toBe("withdraw");
  });

  it("marks the register sold against the lot", async () => {
    const lock = { markSold: vi.fn(async () => ({ status: "moved" })), withdraw: vi.fn() };
    const recorder = new BidOfferLockRecorder(lock as unknown as ArtworkOfferLock, {
      findLink: async () => link({ status: "ended", soldOnAtg: true }),
    });
    await recorder.apply(ended);
    expect(lock.markSold).toHaveBeenCalledWith(
      { registerId: "reg-1" },
      { kind: "bid_lot", id: "lot-1" },
      "system",
    );
    expect(lock.withdraw).not.toHaveBeenCalled();
  });
});
