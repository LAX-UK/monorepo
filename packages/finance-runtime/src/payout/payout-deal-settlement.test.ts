import { payoutTotals } from "@auction/domain";
import type { IPrivateSaleDealPayoutStore } from "@auction/persistence/interfaces";
import type { PayoutLine, PrivateSalePayoutDeal } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { makeSettlementRepo, payoutRow, pending } from "./payout-bulk-settlement-parity.helpers.js";
import { listSettlementEntityIds } from "./payout-helpers.js";
import { createSettlementCore } from "./payout-settlement.js";

const DEAL: PrivateSalePayoutDeal = {
  dealId: "deal-1",
  reference: "PS-0001",
  sellerLegalEntityId: "e1",
  priceMinor: 4_800_000,
  sellerCommissionBps: 1500,
  costsMinor: 25_000,
};
const input = { legalEntityId: "e1", periodStart: new Date(0), periodEnd: new Date() };

function dealStore(
  deals: PrivateSalePayoutDeal[],
  overrides: Partial<IPrivateSaleDealPayoutStore> = {},
): IPrivateSaleDealPayoutStore {
  return {
    findUnsettledReleased: async () => deals,
    listSellerLegalEntityIdsWithUnsettledReleased: async () =>
      deals.map((d) => d.sellerLegalEntityId),
    hasPayoutLine: async () => false,
    listReleasedWithPaidPayout: async () => [],
    insertSaleLine: vi.fn(
      async ({ payoutId, dealId, amount }): Promise<PayoutLine> => ({
        id: `line-${dealId}`,
        payoutId,
        paymentId: null,
        privateSaleDealId: dealId,
        amount,
        kind: "sale",
        createdByUserId: null,
        note: null,
        createdAt: new Date(),
      }),
    ),
    ...overrides,
  };
}

describe("settling a released private sale deal", () => {
  it("pays the price less commission and agreed costs", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    const repo = makeSettlementRepo({ create });
    const result = await createSettlementCore(repo, input, dealStore([DEAL]));
    expect(result.ok).toBe(true);
    // £48,000.00 gross, £7,450.00 taken (15% commission and £250.00 costs), £40,550.00 net.
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: "48000.00",
        platformFee: "7450.00",
        netAmount: "40550.00",
      }),
    );
    expect(result.ok && result.queuedDeals).toEqual([
      { dealId: "deal-1", reference: "PS-0001", netToSellerMinor: 4_055_000 },
    ]);
  });

  it("totals equal payoutTotals of the lines, lots and deals together", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    const repo = makeSettlementRepo({
      create,
      findUnlinkedCapturedPayments: async () =>
        pending([{ id: "p1", amount: "6000.00", platformFee: "1200.00" }]),
    });
    await createSettlementCore(repo, input, dealStore([DEAL]));
    const expected = payoutTotals(
      [
        {
          kind: "sale",
          amount: "6000.00",
          payment: { amount: "6000.00", platformFee: "1200.00" },
        },
        {
          kind: "sale",
          amount: "48000.00",
          payment: { amount: "48000.00", platformFee: "7450.00" },
        },
      ],
      "0.00",
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: expected.gross, netAmount: expected.net }),
    );
    expect(expected.net).toBe("45350.00");
  });

  it("holds back a deal that is not released and paid: nothing pending", async () => {
    const repo = makeSettlementRepo();
    expect(await createSettlementCore(repo, input, dealStore([]))).toEqual({
      ok: false,
      reason: "no_pending_payments",
    });
  });

  it("settles a deal once: a line already on another payout drops out and totals follow", async () => {
    const updateTotals = vi.fn(async () => payoutRow());
    const repo = makeSettlementRepo({
      updateTotals,
      findUnlinkedCapturedPayments: async () =>
        pending([{ id: "p1", amount: "100.00", platformFee: "10.00" }]),
    });
    const store = dealStore([DEAL], { insertSaleLine: vi.fn(async () => null) });
    const result = await createSettlementCore(repo, input, store);
    expect(result.ok && result.queuedDeals).toEqual([]);
    expect(updateTotals).toHaveBeenCalledWith(
      "po1",
      expect.objectContaining({ grossAmount: "100.00", netAmount: "90.00" }),
    );
  });

  it("never queues a deal without a commission", async () => {
    const repo = makeSettlementRepo();
    const store = dealStore([{ ...DEAL, sellerCommissionBps: null as unknown as number }]);
    // The store never returns such a deal; the run still refuses to price one from a guess.
    await expect(createSettlementCore(repo, input, store)).rejects.toThrow(
      "no_settlement_lines_inserted",
    );
  });

  it("lists sellers with lot payments and with released deals, once each", async () => {
    const repo = makeSettlementRepo({
      listLegalEntityIdsWithUnlinkedCapturedPayments: async () => ["e1", "e2"],
    });
    const ids = await listSettlementEntityIds({
      repo,
      transactionRunner: null,
      domainEventSink: null,
      payoutAdjustments: undefined,
      payoutRepoForTx: () => repo,
      dealPayouts: dealStore([DEAL, { ...DEAL, dealId: "deal-2", sellerLegalEntityId: "e3" }]),
    });
    expect(ids.sort()).toEqual(["e1", "e2", "e3"]);
  });
});
