import { describe, expect, it } from "vitest";
import { deal } from "./deal-fixtures.test-util.js";
import {
  DEAL_PAYMENT_TRANSITIONS,
  canMoveDealPayment,
  dealPaymentBlockers,
  dealPaymentIsLive,
  dealPayoutBlockers,
  dealRefundRecorded,
  dealRefundableMinor,
} from "./payment-rules.js";
import { dealPaymentDueMinor, dealPayoutAmounts } from "./settlement-amounts.js";

describe("dealPaymentDueMinor", () => {
  it("is the price when there is no buyer's fee", () => {
    expect(dealPaymentDueMinor({ priceMinor: 4_800_000, buyerFeeBps: 0 })).toBe(4_800_000);
  });

  it("adds the buyer's fee, rounded half up to the penny", () => {
    // 1.5% of £100.50 is £1.5075, which is 151p.
    expect(dealPaymentDueMinor({ priceMinor: 10_050, buyerFeeBps: 150 })).toBe(10_201);
  });

  it("is null until a price is agreed", () => {
    expect(dealPaymentDueMinor({ priceMinor: null, buyerFeeBps: 0 })).toBeNull();
  });
});

describe("dealPayoutAmounts", () => {
  it("takes the commission and the agreed costs from the price", () => {
    expect(
      dealPayoutAmounts({ priceMinor: 4_800_000, sellerCommissionBps: 1500, costsMinor: 25_000 }),
    ).toEqual({
      grossMinor: 4_800_000,
      commissionMinor: 720_000,
      costsMinor: 25_000,
      deductionsMinor: 745_000,
      netMinor: 4_055_000,
    });
  });

  it("rounds the commission half up to the penny", () => {
    // 12.5% of £0.05 is 0.625p, which rounds to 1p.
    const amounts = dealPayoutAmounts({ priceMinor: 5, sellerCommissionBps: 1250, costsMinor: 0 });
    expect(amounts?.commissionMinor).toBe(1);
    expect(amounts?.netMinor).toBe(4);
  });

  it("never counts the buyer's fee on the seller's side", () => {
    const withFee = dealPayoutAmounts({
      priceMinor: 100_000,
      sellerCommissionBps: 1000,
      costsMinor: 0,
    });
    expect(withFee?.netMinor).toBe(90_000);
  });

  it("is null while the price or the commission is not set", () => {
    expect(
      dealPayoutAmounts({ priceMinor: null, sellerCommissionBps: 1500, costsMinor: 0 }),
    ).toBeNull();
    expect(
      dealPayoutAmounts({ priceMinor: 100, sellerCommissionBps: null, costsMinor: 0 }),
    ).toBeNull();
  });

  it("can come to nothing or less when costs exceed the price", () => {
    const amounts = dealPayoutAmounts({
      priceMinor: 10_000,
      sellerCommissionBps: 1000,
      costsMinor: 20_000,
    });
    expect(amounts?.netMinor).toBe(-11_000);
  });
});

describe("dealPaymentBlockers", () => {
  it("lets the buyer pay once the invoice is issued", () => {
    expect(dealPaymentBlockers(deal({ stage: "invoiced", priceMinor: 100 }))).toEqual([]);
  });

  it.each([
    "proposed",
    "offer",
    "agreed",
    "cleared",
    "paid",
    "released",
    "settled",
    "cancelled",
  ] as const)("blocks payment in the %s stage", (stage) => {
    expect(dealPaymentBlockers(deal({ stage, priceMinor: 100 }))).toEqual([
      { code: "deal_not_invoiced" },
    ]);
  });

  it("blocks payment without a price", () => {
    expect(dealPaymentBlockers(deal({ stage: "invoiced", priceMinor: null }))).toEqual([
      { code: "price_not_set" },
    ]);
  });
});

describe("dealPayoutBlockers", () => {
  const released = deal({
    stage: "released",
    priceMinor: 100_000,
    sellerCommissionBps: 1000,
    costsMinor: 0,
  });

  it("releases the payout once the work is released and the money is in", () => {
    expect(dealPayoutBlockers(released, { status: "paid" })).toEqual([]);
  });

  it("holds the payout until the work is released", () => {
    expect(dealPayoutBlockers({ ...released, stage: "paid" }, { status: "paid" })).toEqual([
      { code: "deal_not_released" },
    ]);
  });

  it.each(["open", "processing", "cancelled", "refunded"] as const)(
    "holds the payout while the payment is %s",
    (status) => {
      expect(dealPayoutBlockers(released, { status })).toEqual([{ code: "payment_not_received" }]);
    },
  );

  it("holds the payout when there is no payment", () => {
    expect(dealPayoutBlockers(released, null)).toEqual([{ code: "payment_not_received" }]);
  });

  it("holds the payout without a commission", () => {
    expect(
      dealPayoutBlockers({ ...released, sellerCommissionBps: null }, { status: "paid" }),
    ).toEqual([{ code: "commission_not_set" }]);
  });

  it("holds a payout that would come to nothing", () => {
    expect(dealPayoutBlockers({ ...released, costsMinor: 100_000 }, { status: "paid" })).toEqual([
      { code: "payout_not_positive" },
    ]);
  });
});

describe("deal payment status", () => {
  it("moves only along the table", () => {
    expect(canMoveDealPayment("open", "processing")).toBe(true);
    expect(canMoveDealPayment("processing", "paid")).toBe(true);
    expect(canMoveDealPayment("paid", "refunded")).toBe(true);
    expect(canMoveDealPayment("paid", "cancelled")).toBe(false);
    expect(canMoveDealPayment("refunded", "paid")).toBe(false);
  });

  it("leaves a cancelled or refunded payment where it is", () => {
    expect(DEAL_PAYMENT_TRANSITIONS.cancelled).toEqual([]);
    expect(DEAL_PAYMENT_TRANSITIONS.refunded).toEqual([]);
  });

  it("holds the deal while a payment is open, processing or paid", () => {
    expect(dealPaymentIsLive("open")).toBe(true);
    expect(dealPaymentIsLive("processing")).toBe(true);
    expect(dealPaymentIsLive("paid")).toBe(true);
    expect(dealPaymentIsLive("cancelled")).toBe(false);
    expect(dealPaymentIsLive("refunded")).toBe(false);
  });

  it("counts a refund only when all the money went back", () => {
    expect(dealRefundRecorded(null)).toBe(false);
    expect(dealRefundRecorded({ status: "paid", amountMinor: 100, refundedMinor: 0 })).toBe(false);
    expect(dealRefundRecorded({ status: "refunded", amountMinor: 100, refundedMinor: 60 })).toBe(
      false,
    );
    expect(dealRefundRecorded({ status: "refunded", amountMinor: 100, refundedMinor: 100 })).toBe(
      true,
    );
  });

  it("leaves what has not gone back as still refundable", () => {
    expect(dealRefundableMinor({ amountMinor: 100, refundedMinor: 0 })).toBe(100);
    expect(dealRefundableMinor({ amountMinor: 100, refundedMinor: 40 })).toBe(60);
    expect(dealRefundableMinor({ amountMinor: 100, refundedMinor: 100 })).toBe(0);
    expect(dealRefundableMinor({ amountMinor: 100, refundedMinor: 150 })).toBe(0);
  });
});
