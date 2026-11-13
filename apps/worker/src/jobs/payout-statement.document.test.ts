import { sellerProceeds } from "@auction/domain";
import type { SellerTermsFigures } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { PayoutStatementLineRow } from "../interfaces/payout-statement.repository.js";
import { buyerPhrase, payoutStatementDocument } from "./payout-statement.document.js";
import { renderPayoutStatementPdf } from "./payout-statement.renderer.js";

describe("buyerPhrase", () => {
  it("names the buyer on an ordinary sale", () => {
    expect(buyerPhrase({ buyerName: " A. Collector ", soldAfterAuction: false })).toBe(
      "buyer: A. Collector",
    );
  });

  it("shows a dash when the buyer has no name on record", () => {
    expect(buyerPhrase({ buyerName: null, soldAfterAuction: false })).toBe("buyer: —");
  });

  it("says a sale sold on after a default was sold after the auction, without the next bidder's name", () => {
    const phrase = buyerPhrase({ buyerName: "Zed Quincy", soldAfterAuction: true });
    expect(phrase).toBe("sold after the auction to the next bidder");
    expect(phrase).not.toContain("Quincy");
  });
});

/** A snapshot as the seller-terms policy records it: made by sellerProceeds, never by hand. */
function snapshot(
  hammerPence: number,
  commissionBps: number,
  vat: "standard" | "not_registered" = "standard",
): SellerTermsFigures {
  const proceeds = sellerProceeds({
    hammerPence,
    party: { kind: "agreement", commissionBps },
    vat,
  });
  if (proceeds.basis !== "agreement") throw new Error("fixture must price");
  return {
    hammerPence,
    commissionBps,
    commissionPence: proceeds.commissionPence,
    vatTreatment: vat,
    vatBps: proceeds.vatBps,
    vatPence: proceeds.vatPence,
    netPence: proceeds.netPence,
  };
}

const saleLine = (over: Partial<PayoutStatementLineRow>): PayoutStatementLineRow => ({
  lineId: "line",
  kind: "sale",
  amount: "0",
  note: null,
  paymentId: "pay",
  createdByUserId: null,
  lotTitle: "Harbour at Dusk",
  lotNumber: 31,
  buyerName: "A. Collector",
  soldAfterAuction: false,
  dealReference: null,
  lotHammerPrice: null,
  paymentAmount: null,
  paymentPlatformFee: null,
  sellerTerms: null,
  ...over,
});

const NOW = new Date("2026-11-13T12:00:00Z");
const payout = {
  currency: "GBP",
  stripeFee: "0.00",
  processedAt: new Date("2026-11-12T04:49:00Z"),
};

describe("payoutStatementDocument", () => {
  it("splits each sale from its snapshot, with the rates, and totals the rows", () => {
    const document = payoutStatementDocument({
      payout,
      now: NOW,
      lines: [
        saleLine({ amount: "82000.00", sellerTerms: snapshot(8_200_000, 1500) }),
        saleLine({
          lotTitle: "Small Study",
          lotNumber: 32,
          soldAfterAuction: true,
          amount: "333.00",
          sellerTerms: snapshot(33_300, 1250),
        }),
        saleLine({
          kind: "refund",
          amount: "-50.00",
          note: "Frame damaged",
          paymentId: null,
          lotTitle: null,
          lotNumber: null,
        }),
      ],
    });
    expect(document.rows[0]).toEqual({
      work: "Harbour at Dusk (buyer: A. Collector)",
      lot: "Lot 31",
      hammer: "£82,000.00",
      commission: "−£12,300.00 (15%)",
      vat: "−£2,460.00 (20%)",
      receive: "£67,240.00",
    });
    // Half a penny of commission rounds up: 12.5% of £333.00 is £41.625.
    expect(document.rows[1]).toMatchObject({
      work: "Small Study (sold after the auction to the next bidder)",
      commission: "−£41.63 (12.5%)",
      vat: "−£8.33 (20%)",
      receive: "£283.04",
    });
    // The totals are the rows added up: £67,240.00 + £283.04 − £50.00.
    expect(document.totals).toMatchObject({
      hammer: "£82,333.00",
      commission: "−£12,341.63",
      vat: "−£2,468.33",
      receive: "£67,473.04",
    });
    expect(document.paidOut).toBe("Thu 12 Nov, 04:49 GMT");
    expect(document).toMatchSnapshot();
  });

  it("says no VAT was charged when the company was not VAT-registered", () => {
    const document = payoutStatementDocument({
      payout,
      now: NOW,
      lines: [saleLine({ sellerTerms: snapshot(8_200_000, 1500, "not_registered") })],
    });
    expect(document.rows[0]).toMatchObject({ vat: "No VAT", receive: "£69,700.00" });
    expect(document.notes).toContain("No VAT: London Auction Xchange LTD is not VAT-registered");
  });

  it("shows a payout made before snapshots as recorded, with the lot's real hammer", () => {
    const document = payoutStatementDocument({
      payout: { ...payout, stripeFee: "8.80" },
      now: NOW,
      lines: [
        saleLine({
          amount: "5000.00",
          lotHammerPrice: "4000.00",
          paymentAmount: "5000.00",
          paymentPlatformFee: "1000.00",
        }),
      ],
    });
    expect(document.rows[0]).toMatchObject({
      hammer: "£4,000.00",
      commission: "−£1,000.00",
      vat: "—",
      receive: "£4,000.00",
    });
    expect(document.rows[1]).toMatchObject({ work: "Transfer fee", receive: "−£8.80" });
    expect(document.totals.receive).toBe("£3,991.20");
    expect(document.notes).toEqual([
      "Commission is charged on the hammer price at the rate in your signed agreement, plus VAT. The buyer's premium is paid to LAX and isn't part of your proceeds.",
    ]);
  });

  it("renders the statement as a PDF", async () => {
    const pdf = await renderPayoutStatementPdf({
      payout: {
        id: "5b400001-0000-4000-8000-000000000000",
        legalEntityId: "le",
        periodStart: new Date("2026-11-01T00:00:00Z"),
        periodEnd: new Date("2026-11-11T00:00:00Z"),
        grossAmount: "82000.00",
        platformFee: "14760.00",
        stripeFee: "0.00",
        netAmount: "67240.00",
        currency: "GBP",
        xeroBillId: null,
        stripeTransferId: null,
        processedAt: payout.processedAt,
      },
      entity: { id: "le", legalName: "Northbank Gallery Ltd", displayName: null, vatNumber: null },
      lines: [saleLine({ amount: "82000.00", sellerTerms: snapshot(8_200_000, 1500) })],
      authorNames: new Map(),
      env: {} as never,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
