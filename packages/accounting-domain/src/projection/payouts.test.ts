import { describe, expect, it } from "vitest";
import { documentsAwaited } from "../dependencies.js";
import {
  type Bill,
  type BillPayment,
  type Contact,
  buildBill,
  buildBillPayment,
  contactPartyOf,
  expectedTotals,
  parseLaxReference,
  vendorContactSourceId,
} from "../document.js";
import {
  type BidPayoutFacts,
  type PayoutBooking,
  type ShopArtistPayoutFacts,
  bidPayoutPaidPolicy,
  bidPayoutSettledPolicy,
  poundsText,
  projectBidPayoutPaid,
  projectBidPayoutSettled,
  projectShopArtistPayoutPaid,
  shopArtistPayoutPaidPolicy,
} from "./payouts.js";
import type { Projection } from "./projection.js";

const SELLER = "0b1c2d3e-0000-4000-8000-000000000001";
const PAYOUT = "7a7a7a7a-0000-4000-8000-000000000002";
const BOOKING: PayoutBooking = {
  owedTreatment: "margin_scheme",
  commission: "netted",
  basis: "principal",
};

/** Two lot sales: £1,000 at 15% with VAT, £250.55 at 10% with VAT. Fixture data only. */
function bidFacts(over: Partial<BidPayoutFacts> = {}): BidPayoutFacts {
  return {
    payoutId: PAYOUT,
    seller: { id: SELLER, name: "Seller Ltd (fixture)" },
    createdOn: "2031-11-14",
    grossPence: 125_055,
    platformFeePence: 21_007,
    stripeFeePence: 0,
    netPence: 104_048,
    sales: [
      {
        lotId: "11111111-0000-4000-8000-00000000000a",
        paymentId: "22222222-0000-4000-8000-00000000000a",
        hammerPence: 100_000,
        commissionPence: 15_000,
        commissionVatTreatment: "standard",
        commissionVatPence: 3_000,
        sellerNetPence: 82_000,
      },
      {
        lotId: "11111111-0000-4000-8000-00000000000b",
        paymentId: "22222222-0000-4000-8000-00000000000b",
        hammerPence: 25_055,
        commissionPence: 2_506,
        commissionVatTreatment: "standard",
        commissionVatPence: 501,
        sellerNetPence: 22_048,
      },
    ],
    otherLines: 0,
    paid: { paidOn: "2031-11-20", throughStripe: true },
    ...over,
  };
}

function ok(result: ReturnType<typeof projectBidPayoutSettled>): Projection {
  if (!result.ok) throw new Error(`refused: ${result.refusal.code} ${result.refusal.message}`);
  return result.value;
}

const of = <K extends string>(p: Projection, kind: K) =>
  p.documents.filter((d) => d.kind === kind) as unknown as (K extends "bill"
    ? Bill
    : K extends "bill_payment"
      ? BillPayment
      : Contact)[];

describe("Bid seller payout: the bill", () => {
  it("bills the seller's vendor contact for the payout's net, one line per lot sale, to the penny", () => {
    const p = ok(bidPayoutSettledPolicy(BOOKING)(bidFacts()));
    const [contact] = of(p, "contact");
    const [bill] = of(p, "bill");
    expect(p.documents.map((d) => d.kind)).toEqual(["contact", "bill"]);
    expect(contact?.reference).toBe(`LAX-BID-CON-vendor-${SELLER}`);
    expect(contact?.email).toBeNull();
    expect(contactPartyOf(contact?.reference ?? "")).toBe("vendor");
    expect(bill?.reference).toBe(`LAX-BID-BILL-${PAYOUT}`);
    expect(bill?.contactReference).toBe(contact?.reference);
    expect(bill?.entity).toBe("london_auction_xchange");
    expect(bill?.totals).toEqual({ netPence: 104_048, vatPence: 0, grossPence: 104_048 });
    expect(bill?.lines.map((l) => [l.unitNetPence, l.treatment, l.vatPence])).toEqual([
      [82_000, "margin_scheme", 0],
      [22_048, "margin_scheme", 0],
    ]);
    expect(bill?.issuedOn).toBe("2031-11-14");
    expect(p.parked).toEqual([]);
  });

  it("states the commission split on each line: hammer less commission and the VAT on it", () => {
    const [bill] = of(ok(bidPayoutSettledPolicy(BOOKING)(bidFacts())), "bill");
    expect(bill?.lines[0]?.description).toBe(
      "Lot 11111111-0000-4000-8000-00000000000a: hammer £1000.00 less commission £150.00 and VAT on it £30.00",
    );
    expect(bill?.lines[1]?.description).toContain(
      "hammer £250.55 less commission £25.06 and VAT on it £5.01",
    );
    // What the seller is owed plus what LAX kept is the hammer, sale by sale and in total.
    const facts = bidFacts();
    const kept = facts.sales.reduce((n, s) => n + s.commissionPence + s.commissionVatPence, 0);
    expect((bill?.totals.grossPence ?? 0) + kept).toBe(facts.grossPence);
    expect(kept).toBe(facts.platformFeePence);
  });

  it("parks the bill while the accountant has not said how a seller payout is booked", () => {
    const p = ok(projectBidPayoutSettled(bidFacts()));
    const [bill] = of(p, "bill");
    expect(p.parked).toEqual([{ reference: bill?.reference, reason: "seller_payout_treatment" }]);
    // Built all the same, to the penny, so a person sees what it will be.
    expect(bill?.totals.grossPence).toBe(104_048);
  });

  it("bills a payout it cannot itemise as one line of its net, parked for a person", () => {
    for (const over of [
      { otherLines: 1 },
      { stripeFeePence: 25, netPence: 104_023 },
      { sales: [] },
    ]) {
      const facts = bidFacts(over);
      const p = ok(bidPayoutSettledPolicy(BOOKING)(facts));
      const [bill] = of(p, "bill");
      expect(bill?.lines).toHaveLength(1);
      expect(bill?.totals.grossPence).toBe(facts.netPence);
      expect(p.parked).toEqual([{ reference: bill?.reference, reason: "payout_lines_unmapped" }]);
    }
  });

  it("refuses figures that do not add up, never billing a guess", () => {
    const refused = (facts: BidPayoutFacts) => bidPayoutSettledPolicy(BOOKING)(facts);
    // Net is not gross less fees.
    expect(refused(bidFacts({ netPence: 104_049 }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_facts" },
    });
    // A sale whose seller net is not its hammer less commission and VAT.
    const [a, b] = bidFacts().sales;
    if (!a || !b) throw new Error("fixture");
    expect(refused(bidFacts({ sales: [{ ...a, sellerNetPence: 82_001 }, b] }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_facts" },
    });
    // The sales do not add up to the payout's figures.
    expect(
      refused(bidFacts({ sales: [a, { ...b, commissionPence: 2_505, sellerNetPence: 22_049 }] })),
    ).toMatchObject({ ok: false, refusal: { code: "bad_facts" } });
    // VAT on commission charged by a company that is not registered.
    expect(
      refused(bidFacts({ sales: [{ ...a, commissionVatTreatment: "not_registered" }, b] })),
    ).toMatchObject({ ok: false, refusal: { code: "bad_facts" } });
    // Nothing owed: no bill.
    expect(
      refused(bidFacts({ grossPence: 100, platformFeePence: 100, netPence: 0, otherLines: 1 })),
    ).toMatchObject({ ok: false, refusal: { code: "bad_amount" } });
  });

  describe("each sum check refuses on its own", () => {
    const refusedWith = (facts: BidPayoutFacts, message: RegExp) => {
      const result = bidPayoutSettledPolicy(BOOKING)(facts);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.refusal.code).toBe("bad_facts");
      expect(result.refusal.message).toMatch(message);
    };
    const [a, b] = bidFacts().sales;
    if (!a || !b) throw new Error("fixture has two sales");

    it("payout net is not gross less fees, on the itemised path", () => {
      refusedWith(bidFacts({ netPence: 104_049 }), /net is not its gross less its fees/);
    });

    it("payout net is not gross less fees, on the non-itemised path (its only guard)", () => {
      refusedWith(
        bidFacts({ otherLines: 1, netPence: 104_049 }),
        /net is not its gross less its fees/,
      );
    });

    it("a sale's seller net is not its hammer less commission and VAT", () => {
      refusedWith(
        bidFacts({ sales: [{ ...a, sellerNetPence: 82_001 }, b] }),
        /seller net is not its hammer/,
      );
    });

    it("a wrong split on one sale is refused even when another sale offsets it", () => {
      refusedWith(
        bidFacts({
          sales: [
            { ...a, sellerNetPence: a.sellerNetPence + 1 },
            { ...b, sellerNetPence: b.sellerNetPence - 1 },
          ],
        }),
        /seller net is not its hammer/,
      );
    });

    it("the sales' nets do not add up to the payout's net", () => {
      refusedWith(
        bidFacts({ sales: [a, { ...b, commissionPence: 2_505, sellerNetPence: 22_049 }] }),
        /not its sales added up/,
      );
    });

    it("the sales' hammers do not add up to the payout's gross while the nets agree", () => {
      // Gross and fee both one penny higher: net is unchanged, so only the hammer total is wrong.
      refusedWith(
        bidFacts({ grossPence: 125_056, platformFeePence: 21_008 }),
        /not its sales added up/,
      );
    });
  });

  it("gives the same documents for the same facts (a replay)", () => {
    expect(ok(projectBidPayoutPaid(bidFacts()))).toEqual(ok(projectBidPayoutPaid(bidFacts())));
  });
});

describe("Bid seller payout: the payment", () => {
  it("pays the bill in full from Stripe clearing on the day the payout was paid", () => {
    const p = ok(bidPayoutPaidPolicy(BOOKING)(bidFacts()));
    expect(p.documents.map((d) => d.kind)).toEqual(["contact", "bill", "bill_payment"]);
    const [bill] = of(p, "bill");
    const [payment] = of(p, "bill_payment");
    expect(payment).toMatchObject({
      reference: `LAX-BID-BPAY-${PAYOUT}`,
      billReference: bill?.reference,
      contactReference: bill?.contactReference,
      amountPence: 104_048,
      paidOn: "2031-11-20",
      paidFrom: "stripe_clearing",
    });
    expect(payment && expectedTotals(payment)).toEqual({
      netPence: 104_048,
      vatPence: 0,
      grossPence: 104_048,
    });
    expect(p.parked).toEqual([]);
  });

  it("parks a payment made outside Stripe: LAX holds no account it was paid from", () => {
    const p = ok(
      bidPayoutPaidPolicy(BOOKING)(
        bidFacts({ paid: { paidOn: "2031-11-20", throughStripe: false } }),
      ),
    );
    const [payment] = of(p, "bill_payment");
    expect(p.parked).toEqual([
      { reference: payment?.reference, reason: "payout_paid_outside_stripe" },
    ]);
  });

  it("parks the payment with its bill, so it never waits for a bill that cannot be sent", () => {
    const p = ok(projectBidPayoutPaid(bidFacts()));
    const [bill] = of(p, "bill");
    const [payment] = of(p, "bill_payment");
    expect(p.parked).toEqual([
      { reference: bill?.reference, reason: "seller_payout_treatment" },
      { reference: payment?.reference, reason: "seller_payout_treatment" },
    ]);
  });

  it("refuses a payout that is not paid", () => {
    expect(bidPayoutPaidPolicy(BOOKING)(bidFacts({ paid: null }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_facts" },
    });
  });
});

function shopFacts(over: Partial<ShopArtistPayoutFacts> = {}): ShopArtistPayoutFacts {
  return {
    payoutId: "3c3c3c3c-0000-4000-8000-000000000003",
    payee: { id: "4d4d4d4d-0000-4000-8000-000000000004", name: "Artist (fixture)" },
    source: "order_line",
    sourceRowId: "5e5e5e5e-0000-4000-8000-000000000005",
    grossPence: 45_000,
    deductionsPence: 13_500,
    netPence: 31_500,
    owedOn: "2031-11-01",
    dueOn: "2031-11-15",
    paidOn: "2031-11-16",
    throughStripe: true,
    ...over,
  };
}

describe("Shop artist payout", () => {
  it("bills the artist for the ledger row's net and pays it from Stripe clearing", () => {
    const p = ok(shopArtistPayoutPaidPolicy(BOOKING)(shopFacts()));
    expect(p.documents.map((d) => d.kind)).toEqual(["contact", "bill", "bill_payment"]);
    const [contact] = of(p, "contact");
    const [bill] = of(p, "bill");
    const [payment] = of(p, "bill_payment");
    expect(contact?.reference).toBe("LAX-SHOP-CON-vendor-4d4d4d4d-0000-4000-8000-000000000004");
    expect(bill?.entity).toBe("london_art_exchange");
    expect(bill?.totals).toEqual({ netPence: 31_500, vatPence: 0, grossPence: 31_500 });
    expect(bill?.lines[0]?.description).toBe(
      "Artist payout for order line 5e5e5e5e-0000-4000-8000-000000000005: sale £450.00 less LAX commission £135.00",
    );
    expect(bill?.issuedOn).toBe("2031-11-01");
    expect(bill?.dueOn).toBe("2031-11-15");
    expect(payment?.amountPence).toBe(31_500);
    expect(payment?.paidOn).toBe("2031-11-16");
    expect(p.parked).toEqual([]);
  });

  it("parks bill and payment while principal or agent is not answered", () => {
    const p = ok(projectShopArtistPayoutPaid(shopFacts()));
    expect(p.parked?.map((x) => x.reason)).toEqual([
      "artist_payout_treatment",
      "artist_payout_treatment",
    ]);
  });

  it("parks only the payment when staff marked it paid outside Stripe", () => {
    const p = ok(shopArtistPayoutPaidPolicy(BOOKING)(shopFacts({ throughStripe: false })));
    expect(p.parked).toEqual([
      {
        reference: "LAX-SHOP-BPAY-3c3c3c3c-0000-4000-8000-000000000003",
        reason: "payout_paid_outside_stripe",
      },
    ]);
  });

  it("refuses a row whose net is not the sale less LAX's commission, or owes nothing", () => {
    const policy = shopArtistPayoutPaidPolicy(BOOKING);
    expect(policy(shopFacts({ netPence: 31_501 }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_facts" },
    });
    expect(policy(shopFacts({ deductionsPence: 45_000, netPence: 0 }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_amount" },
    });
  });
});

describe("bill payments and vendor contacts", () => {
  const bill = (contactReference: string) => {
    const built = buildBill({
      product: "bid",
      sourceId: "p1",
      contactReference,
      issuedOn: "2031-11-14",
      dueOn: "2031-11-14",
      lines: [
        {
          description: "x",
          quantity: 1,
          unitNetPence: 500,
          treatment: "outside_scope",
          role: "goods",
        },
      ],
    });
    if (!built.ok) throw new Error("fixture");
    return built.value;
  };

  it("pays exactly the bill, to its vendor contact, and waits for both", () => {
    const vendor = `LAX-BID-CON-${vendorContactSourceId("ABC")}`;
    expect(vendor).toBe("LAX-BID-CON-vendor-abc");
    const b = bill(vendor);
    const paid = buildBillPayment({ bill: b, paidOn: "2031-11-15" });
    if (!paid.ok) throw new Error(paid.refusal.message);
    expect(paid.value.amountPence).toBe(b.totals.grossPence);
    expect(parseLaxReference(paid.value.reference)).toMatchObject({
      ok: true,
      value: { product: "bid", kind: "bill_payment", sourceId: "p1" },
    });
    expect(documentsAwaited(b)).toEqual([vendor]);
    expect(documentsAwaited(paid.value)).toEqual([vendor, b.reference]);
  });

  it("refuses to pay a bill made out to a customer contact", () => {
    expect(buildBillPayment({ bill: bill("LAX-BID-CON-abc"), paidOn: "2031-11-15" })).toMatchObject(
      {
        ok: false,
        refusal: { code: "bad_reference" },
      },
    );
    expect(contactPartyOf("LAX-BID-CON-abc")).toBe("customer");
    expect(contactPartyOf("LAX-BID-INV-vendor-abc")).toBe("customer");
  });

  it("writes pence as pounds exactly", () => {
    expect([poundsText(0), poundsText(5), poundsText(123_456), poundsText(-1_050)]).toEqual([
      "£0.00",
      "£0.05",
      "£1234.56",
      "-£10.50",
    ]);
  });
});
