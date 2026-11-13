import { describe, expect, it } from "vitest";
import {
  type PayableSellerTerms,
  type SellerClawbackFacts,
  sellerClawbackPence,
  sellerRefundCharge,
  sellerTermsTotals,
  snapshotSaleLine,
} from "./seller-payout.js";
import { sellerProceeds } from "./seller-proceeds.js";
import { payoutLineBreakdown, payoutTotals } from "./selling-records.js";

const pounds = (amount: number) => Math.round(amount * 100);

/** A payable snapshot priced by the one calculator, as settlement reads it. */
function payable(hammerPence: number, commissionBps: number, premiumPence = 0): PayableSellerTerms {
  const proceeds = sellerProceeds({
    hammerPence,
    party: { kind: "agreement", commissionBps },
    vat: "standard",
  });
  if (proceeds.basis !== "agreement") throw new Error("expected a payable sale");
  return {
    lotId: "lot",
    sellerLegalEntityId: "seller",
    hammerPence,
    premiumPence,
    ruleVersion: "agreement_hammer_v1",
    basis: "agreement",
    agreementId: "agreement",
    commissionBps,
    commissionPence: proceeds.commissionPence,
    commissionVatTreatment: proceeds.vatTreatment,
    commissionVatBps: proceeds.vatBps,
    commissionVatPence: proceeds.vatPence,
    otherCharges: [],
    sellerNetPence: proceeds.netPence,
  };
}

describe("snapshotSaleLine", () => {
  it("pays the owner's example on the hammer: the premium is never on the seller's line", () => {
    const line = snapshotSaleLine(payable(pounds(82_000), 1500, pounds(20_500)));
    expect(line.amount).toBe("82000.00");
    expect(line.facts).toEqual({
      kind: "sale",
      amount: "82000.00",
      payment: { amount: "82000.00", platformFee: "14760.00" },
    });
    expect(payoutTotals([line.facts], "0.00")).toEqual({
      gross: "82000.00",
      platformFee: "14760.00",
      stripeFee: "0.00",
      net: "67240.00",
    });
  });
});

describe("the owner's example under both rules", () => {
  it("the old rule paid the seller £97,375.00; the agreement pays £67,240.00", () => {
    // Old rule: the sale line was the buyer's payment, less 5% of hammer plus premium.
    const old = payoutLineBreakdown({
      kind: "sale",
      amount: "102500.00",
      payment: { amount: "102500.00", platformFee: "5125.00" },
    });
    const agreed = payoutLineBreakdown(snapshotSaleLine(payable(pounds(82_000), 1500)).facts);
    expect(old).toEqual({ gross: "102500.00", commissionAndFees: "5125.00", net: "97375.00" });
    expect(agreed).toEqual({ gross: "82000.00", commissionAndFees: "14760.00", net: "67240.00" });
    expect(pounds(97_375) - pounds(67_240)).toBe(pounds(30_135));
  });
});

describe("a mixed payout: three sales ready, one held", () => {
  // The held sale (no signed agreement) is left out; the other three are paid in full.
  const ready = [
    payable(pounds(82_000), 1500, pounds(20_500)),
    payable(pounds(333), 1250),
    payable(pounds(10_000), 300),
  ];
  const lines = ready.map((terms) => snapshotSaleLine(terms).facts);

  it("pins the totals: they are the lines added up, to the penny", () => {
    expect(payoutTotals(lines, "0.00")).toEqual({
      gross: "92333.00",
      // 12,300.00 + 2,460.00 + 41.63 + 8.33 + 300.00 + 60.00
      platformFee: "15169.96",
      stripeFee: "0.00",
      // 67,240.00 + 283.04 + 9,640.00
      net: "77163.04",
    });
    expect(sellerTermsTotals(ready)).toEqual({
      hammer: "92333.00",
      commission: "12641.63",
      commissionVat: "2528.33",
    });
  });

  it("the commission and VAT totals make up the platform fee exactly", () => {
    const totals = sellerTermsTotals(ready);
    expect(pounds(Number(totals.commission)) + pounds(Number(totals.commissionVat))).toBe(
      pounds(Number(payoutTotals(lines, "0.00").platformFee)),
    );
  });
});

describe("sellerClawbackPence", () => {
  const owner = { sellerNetPence: pounds(67_240), paymentPence: pounds(102_500) };

  it("a full refund takes back exactly what the seller received, not the buyer's total", () => {
    expect(sellerClawbackPence({ ...owner, buyerRefundedPence: pounds(102_500) })).toBe(
      pounds(67_240),
    );
  });

  it("nothing is taken back before any refund", () => {
    expect(sellerClawbackPence({ ...owner, buyerRefundedPence: 0 })).toBe(0);
  });

  it("a refund of more than was paid still takes back only the net", () => {
    expect(sellerClawbackPence({ ...owner, buyerRefundedPence: pounds(200_000) })).toBe(
      pounds(67_240),
    );
  });

  it("a part refund takes back the same share of the net, half-up", () => {
    // A quarter of the buyer's payment: a quarter of £67,240.
    expect(sellerClawbackPence({ ...owner, buyerRefundedPence: pounds(25_625) })).toBe(
      pounds(16_810),
    );
    // £0.01 of £3.00 paid on a £2.00 net is 0.667p, which rounds to 1p.
    expect(
      sellerClawbackPence({ sellerNetPence: 200, paymentPence: 300, buyerRefundedPence: 1 }),
    ).toBe(1);
  });

  it("is cumulative and never passes the net as refunds add up", () => {
    let previous = 0;
    for (let refunded = 0; refunded <= 1_000; refunded += 37) {
      const now = sellerClawbackPence({
        sellerNetPence: 700,
        paymentPence: 1_000,
        buyerRefundedPence: refunded,
      });
      expect(now).toBeGreaterThanOrEqual(previous);
      expect(now).toBeLessThanOrEqual(700);
      previous = now;
    }
  });

  it("stays exact at £1bn", () => {
    const big = 100_000_000_000;
    expect(
      sellerClawbackPence({ sellerNetPence: big, paymentPence: big, buyerRefundedPence: big - 1 }),
    ).toBe(big - 1);
  });

  it("refuses amounts that are not whole, non-negative pence", () => {
    expect(() => sellerClawbackPence({ ...owner, buyerRefundedPence: -1 })).toThrow(RangeError);
    expect(() => sellerClawbackPence({ ...owner, sellerNetPence: 1.5 })).toThrow(RangeError);
  });
});

describe("sellerRefundCharge", () => {
  const paidFromSnapshot: SellerClawbackFacts = {
    paymentPence: pounds(102_500),
    paidOut: { kind: "snapshot", sellerNetPence: pounds(67_240) },
    clawedBackPence: 0,
    buyerRefundAnsweredPence: 0,
  };

  it("a full refund after payout charges the seller their net, not the buyer's total", () => {
    expect(
      sellerRefundCharge({ facts: paidFromSnapshot, buyerRefundPence: pounds(102_500) }),
    ).toEqual({ chargePence: pounds(67_240), buyerRefundPence: pounds(102_500) });
  });

  it("a refund before payout charges the seller nothing", () => {
    expect(
      sellerRefundCharge({
        facts: { ...paidFromSnapshot, paidOut: { kind: "not_paid_out" } },
        buyerRefundPence: pounds(102_500),
      }),
    ).toBeNull();
  });

  it("two part refunds add up to exactly the net, never more", () => {
    const first = sellerRefundCharge({ facts: paidFromSnapshot, buyerRefundPence: pounds(51_250) });
    expect(first).toEqual({ chargePence: pounds(33_620), buyerRefundPence: pounds(51_250) });
    const second = sellerRefundCharge({
      facts: {
        ...paidFromSnapshot,
        clawedBackPence: first?.chargePence ?? 0,
        buyerRefundAnsweredPence: pounds(51_250),
      },
      buyerRefundPence: pounds(60_000),
    });
    expect(second?.chargePence).toBe(pounds(33_620));
    // Nothing is left to charge once the net has been taken back.
    expect(
      sellerRefundCharge({
        facts: {
          ...paidFromSnapshot,
          clawedBackPence: pounds(67_240),
          buyerRefundAnsweredPence: pounds(102_500),
        },
        buyerRefundPence: pounds(1),
      }),
    ).toBeNull();
  });

  it("a payout paid under the old rule is charged the refund as it stands", () => {
    expect(
      sellerRefundCharge({
        facts: { ...paidFromSnapshot, paidOut: { kind: "old_rule" } },
        buyerRefundPence: pounds(500),
      }),
    ).toEqual({ chargePence: pounds(500), buyerRefundPence: pounds(500) });
  });
});
