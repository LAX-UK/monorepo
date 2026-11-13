import type { SellerClawbackFacts } from "@auction/domain";
import type { InsertPayoutLineInput } from "@auction/persistence/interfaces";
import type { PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";
import { makeSettlementRepo, payoutRow } from "./payout-bulk-settlement-parity.helpers.js";

const pounds = (amount: number) => Math.round(amount * 100);

/** The owner's example once paid out: the buyer paid £102,500.00, the seller received £67,240.00. */
const PAID_FROM_SNAPSHOT: SellerClawbackFacts = {
  paymentPence: pounds(102_500),
  paidOut: { kind: "snapshot", sellerNetPence: pounds(67_240) },
  clawedBackPence: 0,
};

function ledger(facts: SellerClawbackFacts, refundedBefore = 0) {
  const lines: InsertPayoutLineInput[] = [];
  const create = vi.fn(async (input) => payoutRow({ ...input, id: "clawback" }));
  const repo = makeSettlementRepo({
    findSellerClawbackFacts: async () => facts,
    sumRefundLineCentsForPayment: async () => refundedBefore,
    create,
    insertLine: vi.fn(async (line: InsertPayoutLineInput) => {
      lines.push(line);
      return { ...line, id: "l", createdAt: new Date() } as unknown as PayoutLine;
    }),
  });
  const service = new PayoutAdjustmentService({} as never, repo, () => repo);
  const refund = (amount: string) =>
    service.addPaymentLineToOpenPayoutOrCreateClawbackFull({
      legalEntityId: "seller",
      paymentId: "pay-1",
      amount,
      kind: "refund",
      sourceEventId: "evt-1",
      note: "Refund",
      tx: {} as never,
    });
  return { lines, create, refund };
}

describe("a buyer's refund charges the seller what they received, not the buyer's total", () => {
  it("a full refund after payout claws back £67,240.00, not £102,500.00", async () => {
    const { lines, create, refund } = ledger(PAID_FROM_SNAPSHOT);
    await refund("-102500.00");
    expect(lines).toEqual([
      expect.objectContaining({
        kind: "refund",
        amount: "-67240.00",
        buyerRefundPence: pounds(102_500),
      }),
    ]);
    // No payout is open: the clawback payout is the seller's net, nothing more.
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: "-67240.00", netAmount: "-67240.00" }),
    );
  });

  it("a refund before payout charges the seller nothing", async () => {
    const { lines, create, refund } = ledger({
      ...PAID_FROM_SNAPSHOT,
      paidOut: { kind: "not_paid_out" },
    });
    await refund("-102500.00");
    expect(lines).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("a second part refund charges only what is left of the seller's share", async () => {
    const { lines, refund } = ledger(
      { ...PAID_FROM_SNAPSHOT, clawedBackPence: pounds(33_620) },
      pounds(51_250),
    );
    await refund("-51250.00");
    expect(lines[0]).toMatchObject({ amount: "-33620.00", buyerRefundPence: pounds(51_250) });
  });

  it("a sale paid out under the old rule is charged the refund as before", async () => {
    const { lines, refund } = ledger({ ...PAID_FROM_SNAPSHOT, paidOut: { kind: "old_rule" } });
    await refund("-500.00");
    expect(lines[0]).toMatchObject({ amount: "-500.00", buyerRefundPence: pounds(500) });
  });

  it("other lines go on the ledger as given", async () => {
    const { lines } = ledger(PAID_FROM_SNAPSHOT);
    const repo = makeSettlementRepo({
      insertLine: vi.fn(async (line: InsertPayoutLineInput) => {
        lines.push(line);
        return { ...line, id: "l", createdAt: new Date() } as unknown as PayoutLine;
      }),
      create: async (input) => payoutRow({ ...input }),
    });
    const service = new PayoutAdjustmentService({} as never, repo, () => repo);
    await service.addPaymentLineToOpenPayoutOrCreateClawbackFull({
      legalEntityId: "seller",
      paymentId: "pay-1",
      amount: "-200.00",
      kind: "dispute",
      note: "Dispute",
      tx: {} as never,
    });
    expect(lines[0]).toMatchObject({ kind: "dispute", amount: "-200.00", buyerRefundPence: null });
  });
});
