import { describe, expect, it, vi } from "vitest";
import { makeDeal } from "./deal-fixtures.test-util.js";
import { DealPayoutSettlementService } from "./deal-payout-settlement.service.js";
import type { DealTransitionOutcome } from "./deal-transition.service.js";

describe("DealPayoutSettlementService", () => {
  it("settles each released deal whose payout was paid, and counts the rest", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcomes: Record<string, DealTransitionOutcome | Error> = {
      a: { kind: "ok", deal: makeDeal({ stage: "settled" }) },
      b: { kind: "blocked", blockers: [{ code: "invalid_transition" }] },
      c: new Error("db down"),
    };
    const transition = vi.fn(async (dealId: string) => {
      const outcome = outcomes[dealId];
      if (outcome instanceof Error) throw outcome;
      return outcome as DealTransitionOutcome;
    });
    const service = new DealPayoutSettlementService({
      payouts: {
        listReleasedWithPaidPayout: async () => [
          { dealId: "a", payoutId: "po1" },
          { dealId: "b", payoutId: "po1" },
          { dealId: "c", payoutId: "po2" },
        ],
      },
      transitions: { transition },
    });
    expect(await service.settlePaidPayouts()).toEqual({ settled: 1, skipped: 1, failed: 1 });
    expect(transition).toHaveBeenCalledWith("a", "settle", { actorUserId: null });
  });

  it("does nothing when no payout has been paid", async () => {
    const transition = vi.fn();
    const service = new DealPayoutSettlementService({
      payouts: { listReleasedWithPaidPayout: async () => [] },
      transitions: { transition },
    });
    expect(await service.settlePaidPayouts()).toEqual({ settled: 0, skipped: 0, failed: 0 });
    expect(transition).not.toHaveBeenCalled();
  });
});
