import type { BidInvoiceRecord } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { buildInvoiceLines } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { groupStripeLineItems } from "../stripe/stripe-payment-group.gateway.js";
import {
  InvoiceLinesError,
  STRIPE_MAX_LINE_ITEMS,
  checkInvoiceLines,
  loadCheckedInvoiceLines,
} from "./invoice-stripe-lines.js";
import { buildStripeCheckoutLineItems } from "./stripe-checkout-product-display.js";

const lot = (currentPrice: string, buyerPremiumRate = "0.25") =>
  ({ id: "lot-1", saleId: null, currentPrice, buyerPremiumRate }) as unknown as Lot;
const tieredSale = {
  id: "sale-1",
  buyerPremiumTiers: [
    { hammerThresholdMinor: 0, rate: "0.1500" },
    { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
  ],
} as unknown as Sale;
const tieredLot = (price: string) => ({ ...lot(price), saleId: "sale-1" }) as unknown as Lot;

function invoiceFor(paymentLot: Lot, sale: Sale | null, id = "inv-1"): BidInvoiceRecord {
  const built = buildInvoiceLines(paymentLot, sale);
  return {
    id,
    lotId: paymentLot.id,
    buyerLegalEntityId: "buyer",
    sellerLegalEntityId: "seller",
    totalPence: built.totalPence,
    raisedAt: new Date("2026-11-01T10:00:00Z"),
    dueAt: new Date("2026-11-08T23:59:59Z"),
    pricingPolicyId: built.policyId,
    number: null,
    source: "raised",
    voidedAt: null,
    lines: built.lines,
  };
}

function sessionTotal(items: { unitAmountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.unitAmountCents, 0);
}

describe("single checkout lines", () => {
  it.each([
    ["flat sale", lot("1000.00"), null, 125_000],
    ["tiered sale, below the band edge", tieredLot("499999.99"), tieredSale, 57_499_999],
    ["tiered sale, at the band edge", tieredLot("500000.00"), tieredSale, 55_000_000],
  ] as const)(
    "%s: the session total is the invoice total is the payment amount",
    (_n, l, sale, pence) => {
      const invoice = invoiceFor(l, sale);
      const checked = checkInvoiceLines(invoice, "pay-1", pence);
      const items = buildStripeCheckoutLineItems({
        paymentId: "pay-1",
        lotId: "lot-1",
        lotTitle: "Harbour",
        lotNumber: 12,
        medium: null,
        amountCents: pence,
        invoiceLines: checked.lines,
      });
      expect(items.map((i) => i.name)).toEqual(
        checked.lines.map((line) => `Lot 12 · ${line.label}`),
      );
      expect(items.map((i) => i.unitAmountCents)).toEqual(
        checked.lines.map((l2) => l2.amountPence),
      );
      expect(sessionTotal(items)).toBe(invoice.totalPence);
      expect(invoice.totalPence).toBe(pence);
    },
  );

  it("names the premium line with its rate", () => {
    const items = buildStripeCheckoutLineItems({
      paymentId: "p",
      lotId: "lot-1",
      lotTitle: "Harbour",
      lotNumber: 12,
      medium: null,
      amountCents: 125_000,
      invoiceLines: invoiceFor(lot("1000.00"), null).lines,
    });
    expect(items.map((i) => i.name)).toEqual([
      "Lot 12 · Hammer price",
      "Lot 12 · Buyer's premium (25%)",
    ]);
  });

  it("refuses to charge an amount the stored lines do not add up to", () => {
    expect(() =>
      buildStripeCheckoutLineItems({
        paymentId: "p",
        lotId: "lot-1",
        lotTitle: "Harbour",
        lotNumber: 12,
        medium: null,
        amountCents: 124_999,
        invoiceLines: invoiceFor(lot("1000.00"), null).lines,
      }),
    ).toThrow(InvoiceLinesError);
  });
});

describe("checking a stored invoice before it is charged", () => {
  it("throws when the payment has no invoice record", () => {
    expect(() => checkInvoiceLines(undefined, "pay-1", 100)).toThrow(/no stored invoice/);
  });

  it("throws, with its own code, for a voided invoice, even when the figures agree", () => {
    const voided = {
      ...invoiceFor(lot("1000.00"), null),
      voidedAt: new Date("2026-11-02T09:00:00Z"),
    };
    expect(() => checkInvoiceLines(voided, "pay-1", 125_000)).toThrow(/voided/);
    try {
      checkInvoiceLines(voided, "pay-1", 125_000);
    } catch (error) {
      expect(error).toBeInstanceOf(InvoiceLinesError);
      expect((error as InvoiceLinesError).code).toBe("invoice_voided");
    }
  });

  it("throws when the invoice total is not the payment amount", () => {
    expect(() => checkInvoiceLines(invoiceFor(lot("1000.00"), null), "pay-1", 124_999)).toThrow(
      InvoiceLinesError,
    );
  });

  it("throws when the lines do not add up to the invoice total", () => {
    const invoice = { ...invoiceFor(lot("1000.00"), null), totalPence: 125_001 };
    expect(() => checkInvoiceLines(invoice, "pay-1", 125_001)).toThrow(InvoiceLinesError);
  });

  it("reads every payment's invoice in one query", async () => {
    const calls: string[][] = [];
    const a = invoiceFor(lot("100.00"), null, "inv-a");
    const b = invoiceFor(lot("200.00"), null, "inv-b");
    const reader = {
      findByPaymentIds: async (ids: readonly string[]) => {
        calls.push([...ids]);
        return new Map([
          ["pay-a", a],
          ["pay-b", b],
        ]);
      },
    };
    const checked = await loadCheckedInvoiceLines(reader, [
      { paymentId: "pay-a", amountPence: a.totalPence },
      { paymentId: "pay-b", amountPence: b.totalPence },
    ]);
    expect(calls).toEqual([["pay-a", "pay-b"]]);
    expect(checked.get("pay-b")?.invoiceId).toBe("inv-b");
  });
});

describe("group checkout lines", () => {
  const member = (paymentId: string, invoice: BidInvoiceRecord) => ({
    paymentId,
    lotId: invoice.lotId,
    lotTitle: "Harbour",
    lotNumber: 12,
    amountPence: invoice.totalPence,
    invoiceLines: invoice.lines,
  });

  it("charges one Stripe line per stored line, adding up to the group total", () => {
    const a = invoiceFor(lot("1000.00"), null, "inv-a");
    const b = invoiceFor(tieredLot("500000.00"), tieredSale, "inv-b");
    const items = groupStripeLineItems(
      {
        currency: "GBP",
        totalPence: a.totalPence + b.totalPence,
        lines: [member("pay-a", a), member("pay-b", b)],
      },
      { paymentGroupId: "g" },
    );
    expect(items.map((i) => i.price_data?.unit_amount)).toEqual([
      ...a.lines.map((l) => l.amountPence),
      ...b.lines.map((l) => l.amountPence),
    ]);
    expect(items.every((i) => i.quantity === 1)).toBe(true);
  });

  it("refuses a group whose lines do not add up to its total", () => {
    const a = invoiceFor(lot("1000.00"), null);
    expect(() =>
      groupStripeLineItems(
        { currency: "GBP", totalPence: a.totalPence + 1, lines: [member("pay-a", a)] },
        {},
      ),
    ).toThrow(InvoiceLinesError);
  });

  it("refuses a member with no stored lines", () => {
    const a = invoiceFor(lot("1000.00"), null);
    expect(() =>
      groupStripeLineItems(
        {
          currency: "GBP",
          totalPence: a.totalPence,
          lines: [{ ...member("pay-a", a), invoiceLines: [] }],
        },
        {},
      ),
    ).toThrow(InvoiceLinesError);
  });

  it("20 invoices of 5 lines stay within Stripe's 100-line limit, 21 do not", () => {
    const five = Array.from({ length: 5 }, (_v, i) => ({
      kind: "delivery" as const,
      label: `Line ${i}`,
      ratePercent: null,
      amountPence: 100,
    }));
    const members = (count: number) =>
      Array.from({ length: count }, (_v, i) => ({
        paymentId: `pay-${i}`,
        lotId: `lot-${i}`,
        lotTitle: "Lot",
        lotNumber: i,
        amountPence: 500,
        invoiceLines: five,
      }));
    expect(
      groupStripeLineItems({ currency: "GBP", totalPence: 20 * 500, lines: members(20) }, {}),
    ).toHaveLength(STRIPE_MAX_LINE_ITEMS);
    expect(() =>
      groupStripeLineItems({ currency: "GBP", totalPence: 21 * 500, lines: members(21) }, {}),
    ).toThrow(/more than one Stripe checkout/);
  });
});
