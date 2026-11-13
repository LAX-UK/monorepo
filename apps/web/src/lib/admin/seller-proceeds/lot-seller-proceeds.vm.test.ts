import { describe, expect, it } from "vitest";
import { HELD_REASON_LABEL, heldTitle } from "./held-reasons";
import {
  NOTES,
  buildHeldPayoutNotice,
  buildLotSellerProceeds,
  premiumRateLabel,
} from "./lot-seller-proceeds.vm";
import { FIXTURE_HELD_TERMS, FIXTURE_TERMS, fixtureLotProceeds } from "./seller-proceeds.fixture";

function breakdownOf(model: ReturnType<typeof buildLotSellerProceeds>) {
  if (model.kind !== "breakdown") throw new Error(`expected a breakdown, got ${model.kind}`);
  return model;
}

describe("buildLotSellerProceeds", () => {
  it("shows nothing for a lot that has not sold", () => {
    expect(buildLotSellerProceeds(null)).toEqual({ kind: "none" });
    expect(buildLotSellerProceeds(fixtureLotProceeds({ sale: null }))).toEqual({ kind: "none" });
  });

  it("passes the snapshot's figures through untouched", () => {
    const { breakdown, note, action } = breakdownOf(buildLotSellerProceeds(fixtureLotProceeds()));
    expect(breakdown).toMatchObject({
      hammerPence: 620_000,
      commission: { rateBps: 1200, pence: 74_400 },
      vat: { kind: "charged", rateBps: 2000, pence: 14_880 },
      netPence: 530_720,
      paidOut: false,
      status: { kind: "ready" },
      rateSource: { kind: "agreement", reference: "C-1042", signedAt: "2026-10-03T10:00:00.000Z" },
    });
    expect(note).toBeNull();
    expect(action).toBeNull();
  });

  it("takes the premium from the frozen invoice, never a default rate", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: {
            invoice: { totalPence: 744_000, premiumPence: 124_000, premiumRatePercent: "20.000" },
          },
        }),
      ),
    );
    expect(model.breakdown.premium).toEqual({ rateLabel: "20%", buyerPaidPence: 744_000 });
  });

  it("waits for the buyer until the payment is captured", () => {
    const model = buildLotSellerProceeds(
      fixtureLotProceeds({ sale: { paymentStatus: "pending" } }),
    );
    expect(breakdownOf(model).breakdown.status).toEqual({ kind: "waiting_for_buyer" });
  });

  it("reads 'Seller received' and the payout date once paid out", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: {
            payout: { id: "p", status: "paid", processedAt: "2026-11-13T09:00:00.000Z" },
          },
        }),
      ),
    );
    expect(model.breakdown.paidOut).toBe(true);
    expect(model.breakdown.status).toEqual({
      kind: "paid_out",
      paidAt: "2026-11-13T09:00:00.000Z",
    });
  });

  it("explains a payment raised under the old rule and recalculated", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: { terms: { ...FIXTURE_TERMS, source: "recomputed_at_payout" } },
        }),
      ),
    );
    expect(model.breakdown.status.kind).toBe("recalculated");
    expect(model.note).toBe(NOTES.recalculated);
  });

  it("says when the lot was re-awarded at a new hammer", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(fixtureLotProceeds({ sale: { reawarded: true } })),
    );
    expect(model.breakdown.status.kind).toBe("re_awarded");
    expect(model.note).toBe(NOTES.reawarded);
  });

  it("shows LAX-owned stock with nothing paid out", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: { terms: { ...FIXTURE_HELD_TERMS, basis: "lax_owned", heldReason: null } },
        }),
      ),
    );
    expect(model.breakdown).toMatchObject({
      status: { kind: "lax_owned" },
      commission: null,
      netPence: 0,
      rateSource: null,
    });
    expect(model.note).toBe(NOTES.laxOwned);
  });

  it("marks a refund after payout", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: {
            refundedAfterPayout: true,
            payout: { id: "p", status: "paid", processedAt: "2026-11-13T09:00:00.000Z" },
          },
        }),
      ),
    );
    expect(model.breakdown.status.kind).toBe("refunded_after_payout");
    expect(model.breakdown.paidOut).toBe(true);
  });

  it("sends an ATG sale to be settled by hand", () => {
    const model = breakdownOf(buildLotSellerProceeds(fixtureLotProceeds({ soldOnAtg: true })));
    expect(model.breakdown.status.kind).toBe("settle_by_hand");
    expect(model.note).toBe(NOTES.atg);
    expect(model.action).toBe("mark_settled_outside");
  });

  it("names the company when it is not VAT-registered", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: {
            terms: {
              ...FIXTURE_TERMS,
              commissionVatTreatment: "not_registered",
              commissionVatBps: 0,
              commissionVatPence: 0,
              sellerNetPence: 545_600,
            },
          },
        }),
      ),
    );
    expect(model.breakdown.vat).toEqual({
      kind: "not_registered",
      companyName: "London Auction Xchange LTD",
    });
  });

  it("says 'Recorded by staff' for an agreement staff recorded", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          agreement: {
            reference: "C-1042",
            submissionId: "s",
            signedAt: "2026-10-03T12:00:00.000Z",
            source: "recorded",
          },
        }),
      ),
    );
    expect(model.breakdown.rateSource).toEqual({ kind: "recorded_by_staff" });
  });

  it("holds a sale with no figures and offers to record the agreement", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({ sale: { terms: FIXTURE_HELD_TERMS }, agreement: null }),
      ),
    );
    expect(model.breakdown).toMatchObject({
      status: { kind: "held" },
      commission: null,
      vat: null,
      netPence: null,
    });
    expect(model.action).toBe("record_agreement");
  });

  it("does not offer recording for a reason an agreement cannot fix", () => {
    const model = breakdownOf(
      buildLotSellerProceeds(
        fixtureLotProceeds({
          sale: { terms: { ...FIXTURE_HELD_TERMS, heldReason: "vat_setting_missing" } },
        }),
      ),
    );
    expect(model.action).toBeNull();
  });

  it("explains a sale with no snapshot rather than guessing figures", () => {
    expect(buildLotSellerProceeds(fixtureLotProceeds({ sale: { terms: null } }))).toEqual({
      kind: "no_snapshot",
      message: NOTES.noSnapshot,
    });
  });
});

describe("buildHeldPayoutNotice", () => {
  it("reads as the owner-approved notice for a lot with no signed agreement", () => {
    expect(
      buildHeldPayoutNotice(fixtureLotProceeds({ sale: { terms: FIXTURE_HELD_TERMS } })),
    ).toEqual({
      title: "Payout held: no signed agreement",
      body: "Lot 21 sold for £6,200.00 and the buyer has paid. Record the seller's signed consignment agreement so the commission can be worked out.",
      canRecord: true,
      settingsHref: null,
    });
  });

  it("is not shown until the buyer has paid, or once the sale is priced", () => {
    expect(
      buildHeldPayoutNotice(
        fixtureLotProceeds({ sale: { terms: FIXTURE_HELD_TERMS, paymentStatus: "pending" } }),
      ),
    ).toBeNull();
    expect(buildHeldPayoutNotice(fixtureLotProceeds())).toBeNull();
  });

  it("points to the settings when the VAT setting is missing", () => {
    const notice = buildHeldPayoutNotice(
      fixtureLotProceeds({
        sale: { terms: { ...FIXTURE_HELD_TERMS, heldReason: "vat_setting_missing" } },
      }),
    );
    expect(notice?.title).toBe(
      "Payout held: VAT setting for London Auction Xchange LTD is missing",
    );
    expect(notice?.canRecord).toBe(false);
    expect(notice?.settingsHref).not.toBeNull();
  });
});

describe("held reasons", () => {
  it("use the approved words", () => {
    expect(Object.values(HELD_REASON_LABEL).slice(0, 6)).toEqual([
      "No signed agreement",
      "The seller hasn't accepted the agreement yet",
      "The agreement has no commission",
      "The agreement is for another seller",
      "VAT setting for London Auction Xchange LTD is missing",
      "Deductions are more than the hammer",
    ]);
    expect(heldTitle("not_accepted")).toBe(
      "Payout held: the seller hasn't accepted the agreement yet",
    );
  });
});

describe("premiumRateLabel", () => {
  it("states the invoice's rate, or the premium itself when there is no single rate", () => {
    expect(premiumRateLabel("25.000", 155_000)).toBe("25%");
    expect(premiumRateLabel("22.500", 1)).toBe("22.5%");
    expect(premiumRateLabel(null, 155_000)).toBe("£1,550.00");
  });
});
