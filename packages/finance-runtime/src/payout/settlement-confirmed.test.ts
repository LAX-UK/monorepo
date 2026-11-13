import type { IPrivateSaleDealPayoutStore } from "@auction/persistence/interfaces";
import type { PayoutLine, PrivateSalePayoutDeal } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  makeSettlementRepo,
  payoutRow,
  pending,
  storedSellerTerms,
} from "./payout-bulk-settlement-parity.helpers.js";
import { SettlementFiguresChangedError, createSettlementCore } from "./payout-settlement.js";
import { previewSettlement } from "./settlement-preview.js";

const DEAL: PrivateSalePayoutDeal = {
  dealId: "00000000-0000-4000-8000-0000000000d1",
  reference: "PS-0001",
  sellerLegalEntityId: "e1",
  priceMinor: 4_800_000,
  sellerCommissionBps: 1500,
  costsMinor: 25_000,
};
const input = { legalEntityId: "e1", periodStart: new Date(0), periodEnd: new Date() };

function dealStore(deals: PrivateSalePayoutDeal[]): IPrivateSaleDealPayoutStore {
  return {
    findUnsettledReleased: async () => deals,
    listSellerLegalEntityIdsWithUnsettledReleased: async () => [],
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
  };
}

/** What the confirm dialog sends back: the preview's net and the ids behind it. */
async function confirmFrom(
  repo: ReturnType<typeof makeSettlementRepo>,
  deals: IPrivateSaleDealPayoutStore,
) {
  const preview = await previewSettlement(repo, storedSellerTerms(), "e1", deals);
  const netPence =
    preview.sales.reduce((n, s) => n + (s.kind === "ready" ? s.netPence : 0), 0) +
    preview.deals.reduce((n, d) => n + d.netPence, 0);
  return {
    preview,
    confirmed: {
      netPence,
      paymentIds: preview.sales.flatMap((s) => (s.kind === "ready" ? [s.paymentId] : [])),
      dealIds: preview.deals.map((d) => d.dealId),
    },
  };
}

describe("settlement preview: released private-sale deals", () => {
  it("lists the deals the run pays, split as the run splits them, and counts them in the totals", async () => {
    const repo = makeSettlementRepo({
      findUnlinkedCapturedPayments: async () =>
        pending([{ id: "p1", amount: "6000.00", platformFee: "1200.00" }]),
    });
    const preview = await previewSettlement(repo, storedSellerTerms(), "e1", dealStore([DEAL]));
    expect(preview.deals).toEqual([
      {
        dealId: DEAL.dealId,
        reference: "PS-0001",
        pricePence: 4_800_000,
        commissionPence: 720_000,
        costsPence: 25_000,
        netPence: 4_055_000,
      },
    ]);
    // £6,000 sale (£1,200 off) and the £48,000 deal (£7,450 off).
    expect(preview.pendingGross).toBe("54000.00");
    expect(preview.pendingPlatformFee).toBe("8650.00");
    expect(preview.pendingNet).toBe("45350.00");
  });

  it("a seller with only released deals has something to settle", async () => {
    const repo = makeSettlementRepo();
    const preview = await previewSettlement(repo, storedSellerTerms(), "e1", dealStore([DEAL]));
    expect(preview.sales).toEqual([]);
    expect(preview.deals).toHaveLength(1);
    expect(preview.pendingNet).toBe("40550.00");
  });

  it("charges a part refund before payout by the run's own rule, net of what is already charged", async () => {
    const repo = makeSettlementRepo({
      findUnlinkedCapturedPayments: async () =>
        pending([{ id: "p1", amount: "100.00", platformFee: "5.00", refundedPence: 5_000 }]),
      findSellerClawbackFacts: async () => ({
        paymentPence: 10_000,
        paidOut: { kind: "not_paid_out" },
        clawedBackPence: 1_000,
        buyerRefundAnsweredPence: 5_000,
      }),
    });
    const preview = await previewSettlement(repo, storedSellerTerms(), "e1");
    // Share of £50 of £100 against a £95 net is £47.50; £10 is already on the ledger.
    expect(preview.sales[0]).toMatchObject({ refundChargePence: 3_750, netPence: 5_750 });
  });
});

describe("settlement run bound to the confirmed preview", () => {
  it("pays what was confirmed: lots and deals, to the penny", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    const repo = makeSettlementRepo({
      create,
      findUnlinkedCapturedPayments: async () =>
        pending([{ id: "p1", amount: "6000.00", platformFee: "1200.00" }]),
    });
    const deals = dealStore([DEAL]);
    const { preview, confirmed } = await confirmFrom(repo, deals);
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed },
      deals,
      storedSellerTerms(),
    );
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ netAmount: preview.pendingNet }));
  });

  it("pays a deals-only seller when confirmed", async () => {
    const repo = makeSettlementRepo({ create: vi.fn(async (i) => payoutRow({ ...i })) });
    const deals = dealStore([DEAL]);
    const { confirmed } = await confirmFrom(repo, deals);
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed },
      deals,
      storedSellerTerms(),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses with figures_changed when a sale became ready between preview and confirm", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    let rows = pending([{ id: "p1", amount: "6000.00", platformFee: "1200.00" }]);
    const repo = makeSettlementRepo({ create, findUnlinkedCapturedPayments: async () => rows });
    const deals = dealStore([]);
    const { confirmed } = await confirmFrom(repo, deals);
    // Someone records the missing agreement for another sale in another tab.
    rows = pending([
      { id: "p1", amount: "6000.00", platformFee: "1200.00" },
      { id: "p2", amount: "900.00", platformFee: "108.00" },
    ]);
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed },
      deals,
      storedSellerTerms(),
    );
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses when a deal was released after the preview", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    const repo = makeSettlementRepo({
      create,
      findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }]),
    });
    const { confirmed } = await confirmFrom(repo, dealStore([]));
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed },
      dealStore([DEAL]),
      storedSellerTerms(),
    );
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses when the same sales would pay a different net", async () => {
    const create = vi.fn(async (i) => payoutRow({ ...i }));
    const repo = makeSettlementRepo({
      create,
      findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }]),
    });
    const { confirmed } = await confirmFrom(repo, dealStore([]));
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed: { ...confirmed, netPence: confirmed.netPence + 1 } },
      dealStore([]),
      storedSellerTerms(),
    );
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("a confirmed run whose sale line is skipped throws so the transaction rolls back", async () => {
    const updateTotals = vi.fn(async () => undefined);
    const repo = makeSettlementRepo({
      create: vi.fn(async (i) => payoutRow({ ...i })),
      findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }, { id: "p2" }]),
      // Another run paid p2 first.
      tryInsertSaleLine: async (i) =>
        i.paymentId === "p2"
          ? null
          : {
              id: `line-${i.paymentId}`,
              payoutId: i.payoutId,
              paymentId: i.paymentId,
              privateSaleDealId: null,
              amount: i.amount,
              kind: "sale",
              createdByUserId: null,
              note: null,
              createdAt: new Date(),
            },
      updateTotals,
    });
    const { confirmed } = await confirmFrom(repo, dealStore([]));
    await expect(
      createSettlementCore(repo, { ...input, confirmed }, dealStore([]), storedSellerTerms()),
    ).rejects.toBeInstanceOf(SettlementFiguresChangedError);
    expect(updateTotals).not.toHaveBeenCalled();
  });

  it("an unconfirmed run (the nightly run) whose sale line is skipped lowers the totals instead", async () => {
    const updateTotals = vi.fn(async () => undefined);
    const repo = makeSettlementRepo({
      create: vi.fn(async (i) => payoutRow({ ...i })),
      findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }, { id: "p2" }]),
      tryInsertSaleLine: async (i) =>
        i.paymentId === "p2"
          ? null
          : {
              id: `line-${i.paymentId}`,
              payoutId: i.payoutId,
              paymentId: i.paymentId,
              privateSaleDealId: null,
              amount: i.amount,
              kind: "sale",
              createdByUserId: null,
              note: null,
              createdAt: new Date(),
            },
      updateTotals,
    });
    const result = await createSettlementCore(repo, input, dealStore([]), storedSellerTerms());
    expect(result.ok).toBe(true);
    expect(updateTotals).toHaveBeenCalledTimes(1);
  });

  it("refuses when what was confirmed has already been paid", async () => {
    const repo = makeSettlementRepo({ findUnlinkedCapturedPayments: async () => [] });
    const result = await createSettlementCore(
      repo,
      { ...input, confirmed: { netPence: 9_500, paymentIds: ["p1"], dealIds: [] } },
      dealStore([]),
      storedSellerTerms(),
    );
    expect(result).toMatchObject({ ok: false, reason: "figures_changed" });
  });

  it("a run with nothing confirmed (the nightly run) still pays what is waiting", async () => {
    const repo = makeSettlementRepo({
      create: vi.fn(async (i) => payoutRow({ ...i })),
      findUnlinkedCapturedPayments: async () => pending([{ id: "p1" }, { id: "p2" }]),
    });
    const result = await createSettlementCore(repo, input, dealStore([]), storedSellerTerms());
    expect(result.ok).toBe(true);
  });
});
