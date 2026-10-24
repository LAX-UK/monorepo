import { describe, expect, it } from "vitest";
import {
  SALE_AMOUNT_MAX_PENCE,
  approveFeeAvailability,
  checkInvoiceDetails,
  checkOriginalSale,
  checkSaleAmount,
  checkStockHold,
  checkThirdPartySale,
  feeSummary,
  issueInvoiceAvailability,
  pendingFeeOf,
  presentFeeStatus,
  presentHoldStatus,
  presentOriginalSaleStatus,
  presentThirdPartySaleStatus,
  releaseHoldAvailability,
} from "./sales-records.vm";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const FUTURE = "2026-11-01T09:00:00.000Z";
const ARTWORK = { id: "a1" };
const BUYER = { id: "p1" };
const SELLER = { id: "p2" };
const EDITION = { id: "e1" };

describe("statuses read as words", () => {
  it("never shows a raw status", () => {
    const statuses = [
      presentHoldStatus("converted").label,
      presentThirdPartySaleStatus("recorded").label,
      presentFeeStatus("pending").label,
      presentOriginalSaleStatus("deposit_due").label,
    ];
    expect(statuses).toEqual(["Sold", "Recorded", "Awaiting approval", "Deposit due"]);
    for (const label of statuses) expect(label).not.toContain("_");
  });
});

describe("release a hold", () => {
  it("is offered on an active hold to staff who can hold", () => {
    expect(releaseHoldAvailability({ status: "active" }, { canRelease: true })).toEqual({
      kind: "available",
    });
  });

  it.each(["released", "expired", "converted"])("has nothing to do on a %s hold", (status) => {
    expect(releaseHoldAvailability({ status }, { canRelease: true })).toEqual({ kind: "hidden" });
  });

  it("is hidden from staff who cannot hold", () => {
    expect(releaseHoldAvailability({ status: "active" }, { canRelease: false })).toEqual({
      kind: "hidden",
    });
  });
});

describe("approve a fee", () => {
  it("is offered on a pending fee to staff who approve fees", () => {
    expect(approveFeeAvailability({ status: "pending" }, { canApprove: true })).toEqual({
      kind: "available",
    });
  });

  it.each(["approved", "rejected"])("is not offered on a %s fee", (status) => {
    expect(approveFeeAvailability({ status }, { canApprove: true })).toEqual({ kind: "hidden" });
  });

  it("is hidden from staff who record sales but cannot approve fees", () => {
    expect(approveFeeAvailability({ status: "pending" }, { canApprove: false })).toEqual({
      kind: "hidden",
    });
  });

  it("finds the fee awaiting approval and totals a sale's fees", () => {
    const sale = {
      fees: [
        { feeId: "f1", label: "Commission", amountPence: 12000, status: "approved" },
        { feeId: "f2", label: "Handling", amountPence: 2500, status: "pending" },
      ],
    };
    expect(pendingFeeOf(sale)?.feeId).toBe("f2");
    expect(feeSummary(sale)).toBe("£145.00");
    expect(pendingFeeOf({})).toBeNull();
    expect(feeSummary({ fees: [] })).toBeNull();
  });
});

describe("issue an invoice", () => {
  it.each(["reserved", "deposit_due"])("is offered on a %s sale", (status) => {
    expect(issueInvoiceAvailability({ status }, { canInvoice: true })).toEqual({
      kind: "available",
    });
  });

  it("says so when an invoice has already been issued", () => {
    expect(issueInvoiceAvailability({ status: "invoiced" }, { canInvoice: true })).toEqual({
      kind: "blocked",
      reason: "An invoice has already been issued",
    });
  });

  it.each(["paid", "assigned", "cancelled"])("has no invoice step on a %s sale", (status) => {
    expect(issueInvoiceAvailability({ status }, { canInvoice: true })).toEqual({ kind: "hidden" });
  });

  it("is hidden from staff who cannot sell originals", () => {
    expect(issueInvoiceAvailability({ status: "reserved" }, { canInvoice: false })).toEqual({
      kind: "hidden",
    });
  });
});

describe("checkSaleAmount", () => {
  it("accepts an amount in range", () => {
    expect(checkSaleAmount(120000, true, "sale price")).toEqual({ ok: true, pence: 120000 });
  });

  it("tells an empty field from text that is not an amount", () => {
    expect(checkSaleAmount(null, false, "sale price")).toEqual({
      ok: false,
      message: "Enter the sale price in pounds.",
    });
    expect(checkSaleAmount(null, true, "sale price")).toEqual({
      ok: false,
      message: "Enter an amount in pounds, like 1200 or 1200.50.",
    });
  });

  it("refuses zero and more than the database can store", () => {
    expect(checkSaleAmount(0, true, "sale price").ok).toBe(false);
    expect(checkSaleAmount(SALE_AMOUNT_MAX_PENCE, true, "sale price").ok).toBe(true);
    expect(checkSaleAmount(SALE_AMOUNT_MAX_PENCE + 1, true, "sale price")).toEqual({
      ok: false,
      message: "Enter an amount up to £20,000,000.00.",
    });
  });
});

describe("checkOriginalSale", () => {
  const valid = {
    artwork: ARTWORK,
    buyer: BUYER,
    pricePence: 250000,
    priceTyped: true,
    reservationExpiresAt: null,
    now: NOW,
  };

  it("builds the request from the chosen records and pence", () => {
    expect(checkOriginalSale(valid)).toEqual({
      ok: true,
      body: { artworkId: "a1", buyerPartyId: "p1", salePricePence: 250000 },
    });
    expect(checkOriginalSale({ ...valid, reservationExpiresAt: FUTURE })).toMatchObject({
      ok: true,
      body: { reservationExpiresAt: FUTURE },
    });
  });

  it("asks for everything that is missing at once", () => {
    expect(
      checkOriginalSale({
        ...valid,
        artwork: null,
        buyer: null,
        pricePence: null,
        priceTyped: false,
      }),
    ).toEqual({
      ok: false,
      errors: {
        artwork: "Choose the artwork being sold.",
        buyer: "Choose the buyer.",
        price: "Enter the sale price in pounds.",
      },
    });
  });

  it("refuses a reservation that has already ended", () => {
    expect(
      checkOriginalSale({ ...valid, reservationExpiresAt: "2026-10-01T00:00:00.000Z" }),
    ).toEqual({
      ok: false,
      errors: { reservationExpiresAt: "The reservation must end in the future." },
    });
  });
});

describe("checkThirdPartySale", () => {
  const valid = {
    edition: EDITION,
    seller: SELLER,
    buyer: BUYER,
    grossPence: 99900,
    grossTyped: true,
  };

  it("builds the request from the chosen records and pence", () => {
    expect(checkThirdPartySale(valid)).toEqual({
      ok: true,
      body: { editionId: "e1", sellerPartyId: "p2", buyerPartyId: "p1", grossPence: 99900 },
    });
  });

  it("will not record a sale from someone to themselves", () => {
    expect(checkThirdPartySale({ ...valid, buyer: SELLER })).toEqual({
      ok: false,
      errors: { buyer: "The buyer and the seller must be different people." },
    });
  });

  it("names each missing record", () => {
    expect(
      checkThirdPartySale({
        ...valid,
        edition: null,
        seller: null,
        buyer: null,
        grossPence: null,
        grossTyped: false,
      }),
    ).toEqual({
      ok: false,
      errors: {
        edition: "Choose the edition that was sold.",
        seller: "Choose the seller.",
        buyer: "Choose the buyer.",
        gross: "Enter the amount the buyer paid in pounds.",
      },
    });
  });
});

describe("checkStockHold", () => {
  const valid = { edition: EDITION, client: BUYER, expiresAt: FUTURE, note: "", now: NOW };

  it("builds the request, leaving out an empty note", () => {
    expect(checkStockHold(valid)).toEqual({
      ok: true,
      body: { editionId: "e1", clientPartyId: "p1", expiresAt: FUTURE },
    });
    expect(checkStockHold({ ...valid, note: "  For the Marsh viewing " })).toMatchObject({
      ok: true,
      body: { note: "For the Marsh viewing" },
    });
  });

  it("needs an end time in the future", () => {
    expect(checkStockHold({ ...valid, expiresAt: null })).toMatchObject({
      ok: false,
      errors: { expiresAt: "Enter when the hold ends." },
    });
    expect(checkStockHold({ ...valid, expiresAt: "2026-10-24T11:00:00.000Z" })).toMatchObject({
      ok: false,
      errors: { expiresAt: "The hold must end in the future." },
    });
  });

  it("limits the note", () => {
    expect(checkStockHold({ ...valid, note: "n".repeat(1001) })).toMatchObject({
      ok: false,
      errors: { note: "Use 1000 characters or fewer." },
    });
  });
});

describe("checkInvoiceDetails", () => {
  it("accepts an email with an optional name", () => {
    expect(checkInvoiceDetails({ buyerEmail: " ada@example.com ", buyerName: " Ada " })).toEqual({
      ok: true,
      body: { buyerEmail: "ada@example.com", buyerName: "Ada" },
    });
    expect(checkInvoiceDetails({ buyerEmail: "ada@example.com", buyerName: "" })).toEqual({
      ok: true,
      body: { buyerEmail: "ada@example.com" },
    });
  });

  it("asks for a usable email", () => {
    expect(checkInvoiceDetails({ buyerEmail: "", buyerName: "" })).toMatchObject({ ok: false });
    expect(checkInvoiceDetails({ buyerEmail: "ada@", buyerName: "" })).toEqual({
      ok: false,
      errors: { buyerEmail: "Enter a valid email address." },
    });
  });
});
