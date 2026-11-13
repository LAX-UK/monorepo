import {
  type ISellerTermsPolicy,
  SELLER_RULE_VERSION,
  type SellerTermsSnapshot,
  sellerProceeds,
} from "@auction/domain";
import type {
  CreatePayoutInput,
  ISaleSellerTermsStore,
  InsertPayoutLineInput,
  PendingPaymentRow,
} from "@auction/persistence/interfaces";
import type { PayoutLine } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  makeSettlementRepo,
  payoutRow,
  pending,
  storedSellerTerms,
} from "./payout-bulk-settlement-parity.helpers.js";
import type { PayoutSettlementDeps } from "./payout-helpers.js";
import {
  REFUND_BEFORE_PAYOUT_NOTE,
  createSettlement,
  createSettlementCore,
} from "./payout-settlement.js";
import { SettlementSellerTerms } from "./settlement-seller-terms.js";

const SELLER = "00000000-0000-4000-8000-000000000001";
const pounds = (amount: number) => Math.round(amount * 100);
const input = { legalEntityId: SELLER, periodStart: new Date(0), periodEnd: new Date() };

/** A sale priced by the one calculator on a signed agreement, with VAT on the commission. */
function agreementTerms(lotId: string, hammerPence: number, commissionBps: number) {
  const proceeds = sellerProceeds({
    hammerPence,
    party: { kind: "agreement", commissionBps },
    vat: "standard",
  });
  if (proceeds.basis !== "agreement") throw new Error("expected a payable sale");
  return {
    lotId,
    sellerLegalEntityId: SELLER,
    hammerPence,
    premiumPence: Math.round(hammerPence / 4),
    ruleVersion: SELLER_RULE_VERSION,
    basis: "agreement",
    agreementId: `agreement-${lotId}`,
    commissionBps,
    commissionPence: proceeds.commissionPence,
    commissionVatTreatment: "standard",
    commissionVatBps: proceeds.vatBps,
    commissionVatPence: proceeds.vatPence,
    otherCharges: [],
    sellerNetPence: proceeds.netPence,
  } satisfies SellerTermsSnapshot;
}

function heldTerms(lotId: string, hammerPence: number): SellerTermsSnapshot {
  return {
    lotId,
    sellerLegalEntityId: SELLER,
    hammerPence,
    premiumPence: Math.round(hammerPence / 4),
    ruleVersion: SELLER_RULE_VERSION,
    basis: "held",
    heldReason: "no_agreement",
  };
}

const sale = (id: string, snapshot: SellerTermsSnapshot, buyerPaid: string) =>
  pending([
    { id, amount: buyerPaid, sellerTerms: { id: `terms-${id}`, snapshot } },
  ])[0] as PendingPaymentRow;

/** A repository that keeps the payout and lines it is asked to write. */
function recordingRepo(rows: PendingPaymentRow[]) {
  const written: { payout?: CreatePayoutInput; lines: InsertPayoutLineInput[] } = { lines: [] };
  const toLine = (line: InsertPayoutLineInput): PayoutLine => ({
    id: `line-${written.lines.length}`,
    payoutId: line.payoutId,
    paymentId: line.paymentId,
    sellerTermsId: line.sellerTermsId ?? null,
    amount: line.amount,
    kind: line.kind,
    createdByUserId: null,
    note: line.note,
    createdAt: new Date(),
  });
  const repo = makeSettlementRepo({
    findUnlinkedCapturedPayments: async () => rows,
    create: vi.fn(async (payout: CreatePayoutInput) => {
      written.payout = payout;
      return payoutRow({ ...payout, sellerTermsTotals: payout.sellerTermsTotals ?? null });
    }),
    tryInsertSaleLine: vi.fn(async (line: InsertPayoutLineInput) => {
      written.lines.push(line);
      return toLine(line);
    }),
    insertLine: vi.fn(async (line: InsertPayoutLineInput) => {
      written.lines.push(line);
      return toLine(line);
    }),
  });
  return { repo, written };
}

/** The three ready sales of the design's mixed payout, and one held for want of an agreement. */
function mixedPayout() {
  return [
    sale("p1", agreementTerms("lot-1", pounds(82_000), 1500), "102500.00"),
    sale("p2", agreementTerms("lot-2", pounds(333), 1250), "416.25"),
    sale("p3", agreementTerms("lot-3", pounds(10_000), 300), "12500.00"),
    sale("p4", heldTerms("lot-4", pounds(6_200)), "7750.00"),
  ];
}

describe("a payout run pays each sale from its seller terms", () => {
  it("three ready and one held: the held sale is left out with its reason, the rest are paid", async () => {
    const { repo, written } = recordingRepo(mixedPayout());
    const result = await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(result.ok).toBe(true);
    expect(written.lines.map((l) => [l.paymentId, l.amount, l.sellerTermsId])).toEqual([
      ["p1", "82000.00", "terms-p1"],
      ["p2", "333.00", "terms-p2"],
      ["p3", "10000.00", "terms-p3"],
    ]);
    expect(result.heldSales).toEqual([{ paymentId: "p4", lotId: "lot-4", reason: "no_agreement" }]);
    // Pinned: the hammer total, commission plus VAT, and what the seller receives.
    expect(written.payout).toMatchObject({
      grossAmount: "92333.00",
      platformFee: "15169.96",
      stripeFee: "0.00",
      netAmount: "77163.04",
      sellerTermsTotals: { hammer: "92333.00", commission: "12641.63", commissionVat: "2528.33" },
    });
  });

  it("the owner's example: the seller receives £67,240.00, not £97,375.00", async () => {
    const { repo, written } = recordingRepo([
      sale("p1", agreementTerms("lot-1", pounds(82_000), 1500), "102500.00"),
    ]);
    await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(written.payout).toMatchObject({
      grossAmount: "82000.00",
      platformFee: "14760.00",
      netAmount: "67240.00",
    });
    // The buyer's premium is LAX's: nothing on the payout is the £102,500.00 the buyer paid.
    expect(written.lines.map((l) => l.amount)).toEqual(["82000.00"]);
  });

  it("only held sales: nothing is paid and each one is reported", async () => {
    const { repo, written } = recordingRepo([sale("p4", heldTerms("lot-4", 100), "1.25")]);
    const result = await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(result).toEqual({
      ok: false,
      reason: "no_pending_payments",
      heldSales: [{ paymentId: "p4", lotId: "lot-4", reason: "no_agreement" }],
    });
    expect(written.payout).toBeUndefined();
  });

  it("LAX's own stock is never paid out", async () => {
    const laxOwned: SellerTermsSnapshot = {
      lotId: "lot-9",
      sellerLegalEntityId: SELLER,
      hammerPence: pounds(4_800),
      premiumPence: pounds(1_200),
      ruleVersion: SELLER_RULE_VERSION,
      basis: "lax_owned",
    };
    const { repo, written } = recordingRepo([
      sale("p9", laxOwned, "6000.00"),
      sale("p1", agreementTerms("lot-1", pounds(1_500), 0), "1875.00"),
    ]);
    const result = await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(written.lines.map((l) => l.paymentId)).toEqual(["p1"]);
    // A zero-commission agreement is valid: the seller receives the whole hammer.
    expect(written.payout).toMatchObject({ grossAmount: "1500.00", netAmount: "1500.00" });
    expect(result.heldSales).toEqual([]);
  });

  it("a sale another run paid first drops out, and the totals follow what was paid", async () => {
    const { repo, written } = recordingRepo(mixedPayout().slice(0, 2));
    const updateTotals = vi.fn(async () => payoutRow());
    repo.updateTotals = updateTotals;
    repo.tryInsertSaleLine = vi.fn(async (line: InsertPayoutLineInput) => {
      if (line.paymentId === "p2") return null;
      written.lines.push(line);
      return { ...payoutRow(), ...line, id: "l1", createdAt: new Date() } as unknown as PayoutLine;
    });
    const result = await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(result.ok && result.settledSales?.map((s) => s.paymentId)).toEqual(["p1"]);
    expect(updateTotals).toHaveBeenCalledWith("po1", {
      grossAmount: "82000.00",
      platformFee: "14760.00",
      netAmount: "67240.00",
      sellerTermsTotals: { hammer: "82000.00", commission: "12300.00", commissionVat: "2460.00" },
    });
  });

  it("a part refund the buyer had before payout is charged as the sale is paid: the seller's share", async () => {
    const row = {
      ...sale("p1", agreementTerms("lot-1", pounds(82_000), 1500), "102500.00"),
      refundedPence: pounds(25_625),
    };
    const { repo, written } = recordingRepo([row]);
    repo.findSellerClawbackFacts = async () => ({
      paymentPence: pounds(102_500),
      paidOut: { kind: "not_paid_out" },
      clawedBackPence: 0,
    });
    await createSettlementCore(repo, input, null, storedSellerTerms());
    const refund = written.lines.find((l) => l.kind === "refund");
    // A quarter of what the buyer paid: a quarter of the seller's £67,240.00.
    expect(refund).toMatchObject({
      paymentId: "p1",
      amount: "-16810.00",
      buyerRefundPence: pounds(25_625),
      note: REFUND_BEFORE_PAYOUT_NOTE,
    });
    expect(written.payout).toMatchObject({ grossAmount: "65190.00", netAmount: "50430.00" });
  });
});

describe("the settlement event carries each sale's split", () => {
  it("hammer, commission, VAT, net and agreement for every paid sale, and the held ones", async () => {
    const { repo } = recordingRepo(mixedPayout());
    const publish = vi.fn(async () => undefined);
    const deps: PayoutSettlementDeps = {
      repo,
      transactionRunner: { runInTransaction: (fn) => fn({} as never) },
      domainEventSink: { withTx: () => ({ publish }) },
      payoutAdjustments: undefined,
      payoutRepoForTx: () => repo,
      sellerTermsForTx: () => storedSellerTerms(),
    };
    await createSettlement(deps, "staff-1", { legalEntityId: SELLER, periodEnd: new Date() });
    const event = publish.mock.calls[0]?.[0] as unknown as { payload: Record<string, unknown> };
    expect(event.payload).toMatchObject({
      grossAmount: "92333.00",
      platformFee: "15169.96",
      netAmount: "77163.04",
      hammerAmount: "92333.00",
      commissionAmount: "12641.63",
      commissionVatAmount: "2528.33",
      heldSales: [{ paymentId: "p4", lotId: "lot-4", reason: "no_agreement" }],
    });
    expect(event.payload.sales).toEqual([
      expect.objectContaining({
        paymentId: "p1",
        lotId: "lot-1",
        sellerTermsId: "terms-p1",
        agreementId: "agreement-lot-1",
        hammerPence: pounds(82_000),
        commissionBps: 1500,
        commissionPence: pounds(12_300),
        commissionVatPence: pounds(2_460),
        sellerNetPence: pounds(67_240),
      }),
      expect.objectContaining({ paymentId: "p2", sellerNetPence: 28_304 }),
      expect.objectContaining({ paymentId: "p3", sellerNetPence: pounds(9_640) }),
    ]);
  });

  it("running again finds nothing new: a paid sale is on a payout and is not paid twice", async () => {
    const rows = mixedPayout();
    const paid = new Set<string>();
    const { repo } = recordingRepo([]);
    repo.findUnlinkedCapturedPayments = async () => rows.filter((r) => !paid.has(r.id));
    const tryInsert = repo.tryInsertSaleLine;
    repo.tryInsertSaleLine = vi.fn(async (line: InsertPayoutLineInput) => {
      if (line.paymentId) paid.add(line.paymentId);
      return tryInsert(line);
    });
    const first = await createSettlementCore(repo, input, null, storedSellerTerms());
    const second = await createSettlementCore(repo, input, null, storedSellerTerms());
    expect(first.ok).toBe(true);
    expect(second).toEqual({
      ok: false,
      reason: "no_pending_payments",
      heldSales: [{ paymentId: "p4", lotId: "lot-4", reason: "no_agreement" }],
    });
  });
});

describe("SettlementSellerTerms", () => {
  const store = (): ISaleSellerTermsStore & {
    recordAtPayout: ReturnType<typeof vi.fn>;
    repriceHeld: ReturnType<typeof vi.fn>;
  } => ({
    invoiceLinesForPayment: vi.fn(async () => [
      { kind: "hammer", amountPence: pounds(82_000) },
      { kind: "buyers_premium", amountPence: pounds(20_500) },
    ]),
    recordAtPayout: vi.fn(async ({ paymentId, snapshot }) => ({
      id: `new-${paymentId}`,
      snapshot,
    })),
    repriceHeld: vi.fn(async (id, snapshot) => ({ id, snapshot })),
  });
  const agreed: ISellerTermsPolicy = {
    snapshotFor: async (request) => agreementTerms(request.lotId, request.hammerPence, 1500),
  };
  const stillHeld: ISellerTermsPolicy = {
    snapshotFor: async (request) => heldTerms(request.lotId, request.hammerPence),
  };

  it("prices a payment raised before snapshots from its invoice, keeping the old fee beside it", async () => {
    const s = store();
    const row = pending([
      { id: "p1", amount: "102500.00", platformFee: "5125.00", lotId: "lot-1", sellerTerms: null },
    ])[0] as PendingPaymentRow;
    const got = await new SettlementSellerTerms(agreed, s).forRun(row, SELLER);
    expect(got).toMatchObject({ kind: "ready", sellerTermsId: "new-p1" });
    expect(s.recordAtPayout).toHaveBeenCalledWith({
      paymentId: "p1",
      snapshot: expect.objectContaining({
        hammerPence: pounds(82_000),
        sellerNetPence: pounds(67_240),
      }),
      legacyPlatformFeePence: pounds(5_125),
    });
  });

  it("holds a payment whose invoice has no hammer line, and never guesses one from the total", async () => {
    const s = store();
    s.invoiceLinesForPayment = vi.fn(async () => [{ kind: "legacy_total", amountPence: 10_000 }]);
    const row = pending([{ id: "p1", lotId: "lot-1", sellerTerms: null }])[0] as PendingPaymentRow;
    const got = await new SettlementSellerTerms(agreed, s).forRun(row, SELLER);
    expect(got).toEqual({
      kind: "held",
      paymentId: "p1",
      lotId: "lot-1",
      reason: "legacy_invoice",
    });
    expect(s.recordAtPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({ heldReason: "legacy_invoice" }),
      }),
    );
  });

  it("recording the agreement releases a held sale into the next run", async () => {
    const s = store();
    const row = sale("p1", heldTerms("lot-1", pounds(82_000)), "102500.00");
    const got = await new SettlementSellerTerms(agreed, s).forRun(row, SELLER);
    expect(got).toMatchObject({ kind: "ready", sellerTermsId: "terms-p1" });
    expect(s.repriceHeld).toHaveBeenCalledWith(
      "terms-p1",
      expect.objectContaining({ basis: "agreement", sellerNetPence: pounds(67_240) }),
    );
  });

  it("a sale still held is not written again", async () => {
    const s = store();
    const row = sale("p1", heldTerms("lot-1", pounds(82_000)), "102500.00");
    const got = await new SettlementSellerTerms(stillHeld, s).forRun(row, SELLER);
    expect(got).toEqual({ kind: "held", paymentId: "p1", lotId: "lot-1", reason: "no_agreement" });
    expect(s.repriceHeld).not.toHaveBeenCalled();
  });

  it("a priced sale is paid as priced, whatever the agreement says now", async () => {
    const s = store();
    const snapshot = agreementTerms("lot-1", pounds(82_000), 1500);
    const policy = { snapshotFor: vi.fn() };
    const got = await new SettlementSellerTerms(policy, s).forRun(
      sale("p1", snapshot, "102500.00"),
      SELLER,
    );
    expect(got).toEqual({
      kind: "ready",
      paymentId: "p1",
      sellerTermsId: "terms-p1",
      terms: snapshot,
    });
    expect(policy.snapshotFor).not.toHaveBeenCalled();
  });

  it("a preview prices the same way and stores nothing", async () => {
    const s = store();
    const row = sale("p1", heldTerms("lot-1", pounds(82_000)), "102500.00");
    const got = await new SettlementSellerTerms(agreed, s).forPreview(row, SELLER);
    expect(got).toMatchObject({ kind: "ready", terms: { sellerNetPence: pounds(67_240) } });
    expect(s.repriceHeld).not.toHaveBeenCalled();
    expect(s.recordAtPayout).not.toHaveBeenCalled();
  });
});

describe("net never below zero", () => {
  it("a sale whose deductions pass the hammer is held, never paid", () => {
    // 100% commission plus VAT is more than the hammer: the calculator holds it rather than paying.
    expect(
      sellerProceeds({
        hammerPence: 10_000,
        party: { kind: "agreement", commissionBps: 10_000 },
        vat: "standard",
      }),
    ).toMatchObject({ basis: "held", reason: "negative_net" });
  });
});
