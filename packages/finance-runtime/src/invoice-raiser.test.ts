import type {
  BidInvoiceRecord,
  IBidInvoiceRaiseRepository,
  IBidInvoiceReader,
  PaymentRecord,
} from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  InvoiceInvariantError,
  InvoicePricingUnavailableError,
  InvoiceRaiser,
} from "./invoice-raiser.js";

const lot = {
  id: "lot-1",
  saleId: "sale-1",
  buyerLegalEntityId: "buyer-acct",
  sellerLegalEntityId: "seller-acct",
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
} as Lot;
const sale = { id: "sale-1", buyerPremiumTiers: null } as unknown as Sale;
const paymentRow = {
  lotId: "lot-1",
  paidByUserId: "user-1",
  buyerLegalEntityId: "buyer-acct",
  sellerLegalEntityId: "seller-acct",
  platformFee: "62.50",
  stripePaymentIntentId: null,
} as const;

function store(existing: BidInvoiceRecord | null = null) {
  const raise = vi.fn(async (input: Parameters<IBidInvoiceRaiseRepository["raise"]>[0]) => ({
    invoice: { id: "inv-1" } as BidInvoiceRecord,
    payment: { id: "pay-1" } as PaymentRecord,
    invoiceCreated: !existing,
    input,
  }));
  const reader: IBidInvoiceReader = {
    findLiveByLotAndBuyerAccount: vi.fn().mockResolvedValue(existing),
    findByPaymentIds: vi.fn(),
  };
  return { raise, invoices: { ...reader, raise } };
}

const NOW = new Date("2026-11-06T12:00:00.000Z");

describe("InvoiceRaiser.price", () => {
  it("prices a new invoice from the lot and its sale", async () => {
    const { invoices } = store();
    const raiser = new InvoiceRaiser({ invoices, sales: { findById: async () => sale } });
    const priced = await raiser.price(lot);
    expect(priced.totalPence).toBe(125_000);
    expect(priced.lines.map((l) => l.kind)).toEqual(["hammer", "buyers_premium"]);
    expect(priced.existing).toBeNull();
  });

  it("uses the stored lines of a live invoice, never pricing it again", async () => {
    const existing = {
      id: "inv-old",
      lotId: lot.id,
      totalPence: 99_900,
      lines: [{ kind: "legacy_total", label: "Total", ratePercent: null, amountPence: 99_900 }],
      pricingPolicyId: null,
      dueAt: new Date("2026-11-01T23:59:59.999Z"),
    } as BidInvoiceRecord;
    const findById = vi.fn();
    const raiser = new InvoiceRaiser({
      invoices: store(existing).invoices,
      sales: { findById },
    });
    const priced = await raiser.price(lot);
    expect(priced.totalPence).toBe(99_900);
    expect(priced.existing).toBe(existing);
    expect(findById).not.toHaveBeenCalled();
  });

  it("fails when the sale cannot be found, instead of pricing at the lot's flat rate", async () => {
    const raiser = new InvoiceRaiser({
      invoices: store().invoices,
      sales: { findById: async () => null },
    });
    await expect(raiser.price(lot)).rejects.toBeInstanceOf(InvoicePricingUnavailableError);
  });

  it("fails when the sale cannot be read", async () => {
    const raiser = new InvoiceRaiser({
      invoices: store().invoices,
      sales: {
        findById: async () => {
          throw new Error("db down");
        },
      },
    });
    await expect(raiser.price(lot)).rejects.toBeInstanceOf(InvoicePricingUnavailableError);
  });

  it("fails for a lot in a sale when no sale reader is wired", async () => {
    const raiser = new InvoiceRaiser({ invoices: store().invoices, sales: null });
    await expect(raiser.price(lot)).rejects.toBeInstanceOf(InvoicePricingUnavailableError);
  });

  it("prices a lot outside any sale at its own rate", async () => {
    const raiser = new InvoiceRaiser({ invoices: store().invoices, sales: null });
    const priced = await raiser.price({ ...lot, saleId: null });
    expect(priced.totalPence).toBe(125_000);
  });
});

describe("InvoiceRaiser.raise", () => {
  it("stores the invoice with its due date at the end of the London day seven days on", async () => {
    const { invoices, raise } = store();
    const raiser = new InvoiceRaiser({
      invoices,
      sales: { findById: async () => sale },
      now: () => NOW,
    });
    const priced = await raiser.price(lot);
    await raiser.raise({ lot, priced, payment: paymentRow });
    const [{ invoice }] = raise.mock.calls[0] as [{ invoice: { raisedAt: Date; dueAt: Date } }];
    expect(invoice.raisedAt).toEqual(NOW);
    // Friday 6 November 2026 + 7 days = Friday 13 November, to the end of that London day (GMT).
    expect(invoice.dueAt.toISOString()).toBe("2026-11-13T23:59:59.999Z");
  });

  it("refuses lines that do not add up to the total", async () => {
    const { invoices, raise } = store();
    const raiser = new InvoiceRaiser({ invoices, sales: null });
    await expect(
      raiser.raise({
        lot,
        priced: {
          lines: [
            { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
          ],
          totalPence: 125_000,
          policyId: null,
          existing: null,
        },
        payment: paymentRow,
      }),
    ).rejects.toBeInstanceOf(InvoiceInvariantError);
    expect(raise).not.toHaveBeenCalled();
  });

  it.each([
    ["a fractional amount", 100_000.5],
    ["a negative amount", -1],
  ])("refuses %s", async (_name, amountPence) => {
    const { invoices, raise } = store();
    const raiser = new InvoiceRaiser({ invoices, sales: null });
    await expect(
      raiser.raise({
        lot,
        priced: {
          lines: [{ kind: "hammer", label: "Hammer price", ratePercent: null, amountPence }],
          totalPence: amountPence,
          policyId: null,
          existing: null,
        },
        payment: paymentRow,
      }),
    ).rejects.toBeInstanceOf(InvoiceInvariantError);
    expect(raise).not.toHaveBeenCalled();
  });

  it("refuses an invoice with no lines or no total", async () => {
    const { invoices } = store();
    const raiser = new InvoiceRaiser({ invoices, sales: null });
    const base = { lot, payment: paymentRow };
    await expect(
      raiser.raise({
        ...base,
        priced: { lines: [], totalPence: 0, policyId: null, existing: null },
      }),
    ).rejects.toBeInstanceOf(InvoiceInvariantError);
  });
});
