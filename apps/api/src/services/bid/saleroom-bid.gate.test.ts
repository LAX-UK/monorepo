import { describe, expect, it, vi } from "vitest";
import type { ISaleroomSessionLookup } from "../interfaces/saleroom-session-lookup.js";
import { SaleroomBidGate } from "./saleroom-bid.gate.js";
import { SaleroomOnBlockPolicy } from "./saleroom-on-block.policy.js";

function createMockTx(session: { status: string; currentLotId: string | null } | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(session ? [session] : []),
        }),
      }),
    }),
  };
}

function createLookup(enforceOnBlock: boolean): ISaleroomSessionLookup {
  return {
    shouldSkipAntiSnipeForLot: vi.fn(),
    shouldEnforceOnBlockGateForLot: vi.fn().mockResolvedValue(enforceOnBlock),
    isLotUnderLiveClerkSession: vi.fn(),
  };
}

describe("SaleroomBidGate", () => {
  const saleId = "sale-1";
  const lotId = "lot-on-block";

  it("skips on-block checks when lookup does not enforce gate", async () => {
    const gate = new SaleroomBidGate(createLookup(false), new SaleroomOnBlockPolicy({} as never));
    const result = await gate.assertCanBidOnLot({
      lotId,
      saleId,
      tx: createMockTx(null) as never,
    });
    expect(result.isOk()).toBe(true);
  });

  it("delegates to SaleroomOnBlockPolicy with active tx when gate is enforced", async () => {
    const tx = createMockTx({ status: "live", currentLotId: lotId });
    const policy = new SaleroomOnBlockPolicy({} as never);
    const gate = new SaleroomBidGate(createLookup(true), policy);
    const result = await gate.assertCanBidOnLot({ lotId, saleId, tx: tx as never });
    expect(result.isOk()).toBe(true);
  });
});

describe("SaleroomBidGate parity with SaleroomOnBlockPolicy", () => {
  const saleId = "sale-hybrid";
  const lotId = "auc-1";

  const cases: Array<{
    label: string;
    session: { status: string; currentLotId: string | null } | null;
    expectedCode: string | null;
  }> = [
    {
      label: "live on block",
      session: { status: "live", currentLotId: lotId },
      expectedCode: null,
    },
    {
      label: "wrong lot on block",
      session: { status: "live", currentLotId: "other-lot" },
      expectedCode: "lot_not_on_block",
    },
    {
      label: "paused session",
      session: { status: "paused", currentLotId: lotId },
      expectedCode: "saleroom_paused",
    },
    { label: "missing session", session: null, expectedCode: "lot_not_on_block" },
  ];

  it.each(cases)("$label", async ({ session, expectedCode }) => {
    const tx = createMockTx(session);
    const policy = new SaleroomOnBlockPolicy({} as never);
    const gate = new SaleroomBidGate(createLookup(true), policy);

    const direct = await policy.assertLotOnBlock(saleId, lotId, tx as never);
    const gated = await gate.assertCanBidOnLot({ lotId, saleId, tx: tx as never });

    expect(gated.isOk()).toBe(direct.isOk());
    if (expectedCode) {
      expect(gated.isErr()).toBe(true);
      expect(direct.isErr()).toBe(true);
      if (gated.isErr() && direct.isErr()) {
        expect(gated.error.code).toBe(expectedCode);
        expect(direct.error.code).toBe(expectedCode);
      }
    }
  });
});
