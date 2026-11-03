import type { Database } from "@auction/db";
import type { RelistReserveSettlement } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LotTransitionOrchestrator } from "./lot-transition-orchestrator.js";

const lotId = "11111111-1111-4111-8111-111111111111";
const endTime = new Date("2026-10-20T18:00:00Z");
const now = new Date("2026-11-03T10:00:00Z");

function setup(options: { settled?: RelistReserveSettlement | null; guard?: string | null } = {}) {
  const tx = {} as Database;
  const row = {
    id: lotId,
    status: "ended",
    winnerId: null,
    saleId: "22222222-2222-4222-8222-222222222222",
    endTime,
    deletedAt: null,
    archivedSeller: false,
    sellerLegalEntityId: "seller-1",
  } as unknown as Lot;
  const calls: string[] = [];
  const transitions = {
    findLotForUpdate: vi.fn(),
    resetLotForInventoryReturn: vi.fn(async () => {
      calls.push("reset");
    }),
  };
  const relistReserve = {
    settleOnReturn: vi.fn(async (..._args: unknown[]) => {
      calls.push("settle");
      return options.settled ?? null;
    }),
  };
  const recording = {
    recordReturnedToInventory: vi.fn(async () => {
      calls.push("record");
    }),
  };
  const orchestrator = new LotTransitionOrchestrator(
    { runInTransaction: async (fn: (t: Database) => Promise<unknown>) => fn(tx) } as never,
    transitions as never,
    { assertReturnToInventoryAllowed: vi.fn(async () => options.guard ?? null) } as never,
    recording as never,
    { findById: vi.fn(async () => row) } as never,
    null,
    relistReserve,
    () => now,
  );
  return { orchestrator, relistReserve, recording, calls, tx };
}

const input = { reason: "Relist as agreed with the seller" };

describe("LotTransitionOrchestrator.returnToInventory", () => {
  it("puts the agreed reserve on the lot as it returns, and records it in the lot's history", async () => {
    const { orchestrator, relistReserve, recording, calls, tx } = setup({
      settled: {
        followUpId: "33333333-3333-4333-8333-333333333333",
        previousReserve: "5000.00",
        appliedReserve: "4200.00",
      },
    });
    const result = await orchestrator.returnToInventory("staff-1", "staff", lotId, input, [
      "administrator",
    ]);
    expect(result.isOk()).toBe(true);
    expect(relistReserve.settleOnReturn).toHaveBeenCalledWith(
      tx,
      { lotId, lotEndTime: endTime },
      "staff-1",
      now,
    );
    expect(calls).toEqual(["reset", "settle", "record"]);
    expect(recording.recordReturnedToInventory).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({
        reserveApplied: {
          followUpId: "33333333-3333-4333-8333-333333333333",
          from: "5000.00",
          to: "4200.00",
        },
      }),
      "staff-1",
    );
  });

  it("records no reserve change when the choice kept the reserve it ended with", async () => {
    const { orchestrator, recording } = setup({
      settled: {
        followUpId: "33333333-3333-4333-8333-333333333333",
        previousReserve: "5000.00",
        appliedReserve: null,
      },
    });
    await orchestrator.returnToInventory("staff-1", "staff", lotId, input, ["administrator"]);
    const payload = (recording.recordReturnedToInventory.mock.calls[0] as unknown[])[2];
    expect(payload).not.toHaveProperty("reserveApplied");
  });

  it("returns a lot with no confirmed relist as before", async () => {
    const { orchestrator, recording } = setup();
    const result = await orchestrator.returnToInventory("staff-1", "staff", lotId, input, [
      "administrator",
    ]);
    expect(result.isOk()).toBe(true);
    expect(recording.recordReturnedToInventory).toHaveBeenCalledTimes(1);
  });

  it("refuses a lot confirmed for return, and changes nothing", async () => {
    const { orchestrator, relistReserve, recording } = setup({
      guard: "This lot is confirmed for return to its seller, so it cannot be relisted.",
    });
    const result = await orchestrator.returnToInventory("staff-1", "staff", lotId, input, [
      "administrator",
    ]);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 422 });
    expect(relistReserve.settleOnReturn).not.toHaveBeenCalled();
    expect(recording.recordReturnedToInventory).not.toHaveBeenCalled();
  });
});
