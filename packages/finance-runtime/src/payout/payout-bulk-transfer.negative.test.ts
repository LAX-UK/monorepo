import { describe, expect, it, vi } from "vitest";
import {
  entityId,
  makeSettlementRepo,
  payoutRow,
  runBulkSettlementParity,
  settlementDeps,
} from "./payout-bulk-settlement-parity.helpers.js";
import type { InitiateTransferResult } from "./types.js";

/**
 * A payout a refund or dispute line made with a negative net (it found no open payout) is handed
 * to the transfer step at the end of the run, whose negative-net path moves it to
 * `clawback_pending`. Left scheduled, nothing would pick it up.
 */
describe("bulk payout run: scheduled payouts with a negative net", () => {
  const seller = entityId(7);
  const negative = payoutRow({ id: "po-neg", legalEntityId: seller, netAmount: "-50.00" });

  function run(opts: { resume?: string[]; negatives?: string[] } = {}) {
    const order: string[] = [];
    const initiateTransfer = vi.fn(async (payoutId: string): Promise<InitiateTransferResult> => {
      order.push(payoutId);
      return payoutId === "po-neg"
        ? { ok: false, reason: "negative_net_amount" }
        : { ok: true, stripeTransferId: `tr_${payoutId}` };
    });
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn().mockResolvedValue([]),
      listScheduledPayoutsAwaitingTransfer: vi
        .fn()
        .mockResolvedValue(
          (opts.resume ?? []).map((id) => payoutRow({ id, legalEntityId: seller })),
        ),
      listScheduledPayoutsWithNegativeNet: vi
        .fn()
        .mockResolvedValue(
          (opts.negatives ?? ["po-neg"]).map((id) =>
            id === "po-neg" ? negative : payoutRow({ id, legalEntityId: seller }),
          ),
        ),
    });
    return {
      order,
      initiateTransfer,
      result: runBulkSettlementParity(settlementDeps(repo), initiateTransfer),
    };
  }

  it("hands a negative payout to the transfer step, which moves it to clawback", async () => {
    const { initiateTransfer, result } = run();
    const r = await result;

    expect(initiateTransfer).toHaveBeenCalledWith("po-neg");
    expect(r.transfers.items).toEqual([
      {
        legalEntityId: seller,
        payoutId: "po-neg",
        resume: true,
        outcome: "committed_no_transfer",
        reason: "negative_net_amount",
      },
    ]);
  });

  it("does so after every positive payout of the run has been sent", async () => {
    const { order, result } = run({ resume: ["po-pos-1", "po-pos-2"] });
    await result;

    expect(order).toEqual(["po-pos-1", "po-pos-2", "po-neg"]);
  });

  it("hands each payout over once in a run", async () => {
    const { initiateTransfer, result } = run({ resume: ["po-neg"] });
    await result;

    expect(initiateTransfer.mock.calls.filter(([id]) => id === "po-neg")).toHaveLength(1);
  });
});
