import { describe, expect, it } from "vitest";
import {
  type PayableSellerTerms,
  type SellerClawbackFacts,
  sellerClawbackPence,
  sellerRefundCharge,
  sellerRefundChargeAtPayout,
  sellerRefundGiveBack,
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
    // Nothing is left to charge once the net has been taken back; the refund is still answered.
    expect(
      sellerRefundCharge({
        facts: {
          ...paidFromSnapshot,
          clawedBackPence: pounds(67_240),
          buyerRefundAnsweredPence: pounds(102_500),
        },
        buyerRefundPence: pounds(1),
      }),
    ).toEqual({ chargePence: 0, buyerRefundPence: pounds(1) });
  });

  it("a refund whose share rounds to nothing is charged £0.00 and still answered for", () => {
    // £1,250 paid, £820 net: a 1p refund takes back 1p (0.656p, half-up), the second 1p nothing
    // more (1.312p rounds to 1p), and the third 1p brings it to 2p (1.968p).
    const facts: SellerClawbackFacts = {
      paymentPence: pounds(1_250),
      paidOut: { kind: "snapshot", sellerNetPence: pounds(820) },
      clawedBackPence: 0,
      buyerRefundAnsweredPence: 0,
    };
    const first = sellerRefundCharge({ facts, buyerRefundPence: 1 });
    expect(first).toEqual({ chargePence: 1, buyerRefundPence: 1 });
    const second = sellerRefundCharge({
      facts: { ...facts, clawedBackPence: 1, buyerRefundAnsweredPence: 1 },
      buyerRefundPence: 1,
    });
    expect(second).toEqual({ chargePence: 0, buyerRefundPence: 1 });
    // Measured from both earlier refunds, because the zero line answered for the second.
    expect(
      sellerRefundCharge({
        facts: { ...facts, clawedBackPence: 1, buyerRefundAnsweredPence: 2 },
        buyerRefundPence: 1,
      }),
    ).toEqual({ chargePence: 1, buyerRefundPence: 1 });
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

describe("sellerRefundGiveBack", () => {
  // £1,000 hammer and £250 premium at 15% + VAT: the seller's net is £820.00.
  const paid: SellerClawbackFacts = {
    paymentPence: pounds(1_250),
    paidOut: { kind: "snapshot", sellerNetPence: pounds(820) },
    clawedBackPence: pounds(328),
    buyerRefundAnsweredPence: pounds(500),
  };

  it("a failed £500 refund gives back the £328.00 share it charged, and reverses the £500", () => {
    expect(sellerRefundGiveBack({ facts: paid, reversedBuyerRefundPence: pounds(500) })).toEqual({
      chargePence: -pounds(328),
      buyerRefundPence: -pounds(500),
    });
  });

  it("one of two £250 refunds failing gives back the difference to the share of what stands", () => {
    // £500 answered and £328.00 charged; £250 still stands, whose share is £164.00.
    expect(sellerRefundGiveBack({ facts: paid, reversedBuyerRefundPence: pounds(250) })).toEqual({
      chargePence: -pounds(164),
      buyerRefundPence: -pounds(250),
    });
  });

  it("never gives back more than was charged, and records the reversal when nothing was", () => {
    // The 1p refund's share rounded to nothing: the reversal is still recorded, at £0.00.
    expect(
      sellerRefundGiveBack({
        facts: { ...paid, clawedBackPence: 0, buyerRefundAnsweredPence: 1 },
        reversedBuyerRefundPence: 1,
      }),
    ).toEqual({ chargePence: 0, buyerRefundPence: -1 });
    // Already given back elsewhere: nothing more comes back.
    expect(
      sellerRefundGiveBack({
        facts: { ...paid, clawedBackPence: pounds(100) },
        reversedBuyerRefundPence: pounds(250),
      }),
    ).toEqual({ chargePence: 0, buyerRefundPence: -pounds(250) });
  });

  it("reverses only what the seller's lines answered for", () => {
    // A refund before payout charges nothing and puts no line on the ledger: nothing to reverse.
    expect(
      sellerRefundGiveBack({
        facts: {
          ...paid,
          paidOut: { kind: "not_paid_out" },
          clawedBackPence: 0,
          buyerRefundAnsweredPence: 0,
        },
        reversedBuyerRefundPence: pounds(500),
      }),
    ).toBeNull();
    // More reversed than the lines answered for: only what they answered for is taken back.
    expect(sellerRefundGiveBack({ facts: paid, reversedBuyerRefundPence: pounds(600) })).toEqual({
      chargePence: -pounds(328),
      buyerRefundPence: -pounds(500),
    });
  });

  it("a refund charged in full by the previous release is given back in full", () => {
    const fullCharge = { clawedBackPence: pounds(500), buyerRefundAnsweredPence: pounds(500) };
    for (const paidOut of [{ kind: "old_rule" }, { kind: "not_paid_out" }] as const) {
      expect(
        sellerRefundGiveBack({
          facts: { ...paid, ...fullCharge, paidOut },
          reversedBuyerRefundPence: pounds(500),
        }),
      ).toEqual({ chargePence: -pounds(500), buyerRefundPence: -pounds(500) });
    }
    // On a sale paid from its snapshot, the give-back takes the ledger to the share of what
    // stands: £250 stands, so the seller keeps £164.00 charged of the old £500.
    expect(
      sellerRefundGiveBack({
        facts: { ...paid, ...fullCharge },
        reversedBuyerRefundPence: pounds(250),
      }),
    ).toEqual({ chargePence: -pounds(336), buyerRefundPence: -pounds(250) });
  });

  it("a charge, then a give-back, then the same refund again charges the share once more", () => {
    const back = sellerRefundGiveBack({ facts: paid, reversedBuyerRefundPence: pounds(500) });
    const after: SellerClawbackFacts = {
      ...paid,
      clawedBackPence: paid.clawedBackPence + (back?.chargePence ?? 0),
      buyerRefundAnsweredPence: paid.buyerRefundAnsweredPence + (back?.buyerRefundPence ?? 0),
    };
    expect(after).toMatchObject({ clawedBackPence: 0, buyerRefundAnsweredPence: 0 });
    expect(sellerRefundCharge({ facts: after, buyerRefundPence: pounds(500) })).toEqual({
      chargePence: pounds(328),
      buyerRefundPence: pounds(500),
    });
  });

  it("rejects amounts that are not whole, non-negative pence", () => {
    expect(() => sellerRefundGiveBack({ facts: paid, reversedBuyerRefundPence: -1 })).toThrow(
      RangeError,
    );
    expect(() =>
      sellerRefundGiveBack({
        facts: { ...paid, buyerRefundAnsweredPence: -1 },
        reversedBuyerRefundPence: 1,
      }),
    ).toThrow(RangeError);
  });
});

describe("sellerRefundChargeAtPayout", () => {
  // £1,000 hammer and £250 premium at 15% + VAT: the seller's net is £820.00.
  const sale = { sellerNetPence: pounds(820), paymentPence: pounds(1_250) };

  it("a part refund before payout is charged as the seller's share as the sale is paid", () => {
    expect(
      sellerRefundChargeAtPayout({
        ...sale,
        buyerRefundedPence: pounds(500),
        clawedBackPence: 0,
        buyerRefundAnsweredPence: 0,
      }),
    ).toEqual({ chargePence: pounds(328), buyerRefundPence: pounds(500) });
  });

  it("nothing refunded and nothing charged records nothing", () => {
    expect(
      sellerRefundChargeAtPayout({
        ...sale,
        buyerRefundedPence: 0,
        clawedBackPence: 0,
        buyerRefundAnsweredPence: 0,
      }),
    ).toBeNull();
  });

  it("gives back what the previous release charged in full beyond the seller's share", () => {
    // £500 refunded before this release and charged as £500; the share is £328.00.
    expect(
      sellerRefundChargeAtPayout({
        ...sale,
        buyerRefundedPence: pounds(500),
        clawedBackPence: pounds(500),
        buyerRefundAnsweredPence: pounds(500),
      }),
    ).toEqual({ chargePence: -pounds(172), buyerRefundPence: 0 });
    // With a further £250 refunded since, under this release: the share of £750 is £492.00.
    expect(
      sellerRefundChargeAtPayout({
        ...sale,
        buyerRefundedPence: pounds(750),
        clawedBackPence: pounds(500),
        buyerRefundAnsweredPence: pounds(500),
      }),
    ).toEqual({ chargePence: -pounds(8), buyerRefundPence: pounds(250) });
  });

  it("a charge already at the share records nothing more", () => {
    expect(
      sellerRefundChargeAtPayout({
        ...sale,
        buyerRefundedPence: pounds(500),
        clawedBackPence: pounds(328),
        buyerRefundAnsweredPence: pounds(500),
      }),
    ).toBeNull();
  });
});
