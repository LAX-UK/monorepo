import { payoutTotals } from "@auction/domain";
import type { PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";
import { makeSettlementRepo, payoutRow, pending } from "./payout-bulk-settlement-parity.helpers.js";
import { createSettlementCore } from "./payout-settlement.js";

const PAYMENT = { amount: "6000.00", platformFee: "1200.00" };

describe("a payout's stored totals are its lines added up", () => {
  it("at creation: the totals equal payoutTotals of the lines, for a part-settled payment too", async () => {
    const stored: { lines: PayoutLine[]; create?: Record<string, string> } = { lines: [] };
    const repo = makeSettlementRepo({
      findUnlinkedCapturedPayments: vi.fn().mockResolvedValue(
        pending([
          { id: "p1", amount: "6000.00", platformFee: "1200.00" },
          { id: "p2", amount: "300.00", platformFee: "10.00", settlementAmount: "100.00" },
        ]),
      ),
      create: vi.fn(async (input) => {
        stored.create = input as never;
        return payoutRow({ ...input });
      }),
      tryInsertSaleLine: vi.fn(async (input) => {
        const line = {
          id: `l-${input.paymentId}`,
          payoutId: input.payoutId,
          paymentId: input.paymentId,
          amount: input.amount,
          kind: "sale" as const,
          createdByUserId: null,
          note: null,
          createdAt: new Date(),
        };
        stored.lines.push(line);
        return line;
      }),
    });
    const result = await createSettlementCore(repo, {
      legalEntityId: "e1",
      periodStart: new Date(0),
      periodEnd: new Date(),
    });
    expect(result.ok).toBe(true);
    const facts = stored.lines.map((line) => ({
      ...line,
      payment: line.paymentId === "p1" ? PAYMENT : { amount: "300.00", platformFee: "10.00" },
    }));
    const expected = payoutTotals(facts, "0.00");
    expect(stored.create).toMatchObject({
      grossAmount: expected.gross,
      platformFee: expected.platformFee,
      netAmount: expected.net,
    });
    expect(expected.net).toBe("4896.67");
  });

  it("after an adjustment: recalculating stores payoutTotals of the lines", async () => {
    const lines: PayoutLine[] = [
      {
        id: "a",
        payoutId: "po1",
        paymentId: "p1",
        amount: "4800.00",
        kind: "sale",
        createdByUserId: null,
        note: null,
        createdAt: new Date(),
        payment: PAYMENT,
      },
      {
        id: "b",
        payoutId: "po1",
        paymentId: null,
        amount: "-100.00",
        kind: "adjustment",
        createdByUserId: "admin",
        note: "Packing",
        createdAt: new Date(),
        payment: null,
      },
    ];
    const updateTotals = vi.fn(async () => payoutRow());
    const repo = makeSettlementRepo({
      findById: async () => payoutRow({ id: "po1", stripeFee: "12.50" }),
      listLines: async () => lines,
      updateTotals,
    });
    const service = new PayoutAdjustmentService({} as never, repo);
    await service.recalculateTotalsFromLines(repo, "po1");
    const expected = payoutTotals(lines, "12.50");
    expect(updateTotals).toHaveBeenCalledWith("po1", {
      grossAmount: expected.gross,
      platformFee: expected.platformFee,
      netAmount: expected.net,
    });
    expect(expected).toMatchObject({ gross: "4700.00", platformFee: "960.00", net: "3727.50" });
  });
});
