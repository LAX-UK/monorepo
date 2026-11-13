import { describe, expect, it } from "vitest";
import {
  SELLER_COMMISSION_COPY,
  receiveFact,
  recordedSaleFigures,
  reofferConsentLine,
  snapshotSaleFigures,
  soldReceiveFigure,
} from "./seller-commission.vm";
import { snapshotFixture } from "./seller-terms-fixture.test-util";

describe("snapshotSaleFigures", () => {
  it("shows the snapshot's figures with their rates", () => {
    expect(snapshotSaleFigures(snapshotFixture(8_200_000, 1500), "GBP")).toEqual({
      hammer: "£82,000.00",
      commission: { amount: "−£12,300.00", rate: "15%" },
      vat: { amount: "−£2,460.00", rate: "20%" },
      receive: "£67,240.00",
      noVat: false,
      recorded: false,
      pence: { hammer: 8_200_000, commission: 1_230_000, vat: 246_000, receive: 6_724_000 },
    });
  });

  it("shows a half penny of commission rounded up, as the snapshot recorded it", () => {
    const figures = snapshotSaleFigures(snapshotFixture(33_300, 1250), "GBP");
    expect(figures.commission).toEqual({ amount: "−£41.63", rate: "12.5%" });
    expect(figures.receive).toBe("£283.04");
  });

  it("shows no VAT rate when the company was not VAT-registered", () => {
    const figures = snapshotSaleFigures(snapshotFixture(8_200_000, 1500, "not_registered"), "GBP");
    expect(figures).toMatchObject({ noVat: true, vat: { amount: "£0.00", rate: null } });
    expect(figures.receive).toBe("£69,700.00");
  });

  it("never re-works a figure: an odd snapshot is shown as recorded", () => {
    const recorded = { ...snapshotFixture(8_200_000, 1500), netPence: 6_700_000 };
    expect(snapshotSaleFigures(recorded, "GBP").receive).toBe("£67,000.00");
  });
});

describe("recordedSaleFigures", () => {
  it("shows a sale paid before snapshots with its real hammer and the recorded fee", () => {
    expect(
      recordedSaleFigures(
        { hammer: "4000.00", commissionAndFees: "1000.00", net: "4000.00" },
        "GBP",
      ),
    ).toMatchObject({
      hammer: "£4,000.00",
      commission: { amount: "−£1,000.00", rate: null },
      vat: null,
      receive: "£4,000.00",
      recorded: true,
    });
  });
});

describe("soldReceiveFigure", () => {
  it("says After payment before the buyer pays", () => {
    const figure = soldReceiveFigure({ net: null, stage: "buyer_paying" });
    expect(figure).toEqual({ value: "After payment", pending: true });
    expect(receiveFact(figure)).toBe("you receive: After payment");
  });

  it("says Being confirmed while a paid sale cannot be priced yet", () => {
    expect(soldReceiveFigure({ net: null, stage: "paid_by_buyer" })).toEqual({
      value: "Being confirmed",
      pending: true,
    });
  });

  it("shows the figure once known, and nothing for a sale refunded before payout", () => {
    const figure = soldReceiveFigure({ net: "67240.00", stage: "paid_out" });
    expect(figure).toEqual({ value: "£67,240.00", pending: false });
    expect(receiveFact(figure)).toBe("£67,240.00 you receive");
    expect(soldReceiveFigure({ net: null, stage: "refunded" }).value).toBe("£0.00");
    expect(soldReceiveFigure({ net: "67240.00", stage: "refunded" }).value).toBe("£67,240.00");
  });
});

describe("the approved copy", () => {
  it("is word for word", () => {
    expect(SELLER_COMMISSION_COPY.soldNote).toBe(
      '"You receive" is the hammer less your commission and the VAT on it, as set in your signed agreement.',
    );
    expect(SELLER_COMMISSION_COPY.payoutNote).toBe(
      "Commission is charged on the hammer price at the rate in your signed agreement, plus VAT. The buyer's premium is paid to LAX and isn't part of your proceeds.",
    );
    expect(SELLER_COMMISSION_COPY.noVat).toBe(
      "No VAT: London Auction Xchange LTD is not VAT-registered",
    );
    expect(
      reofferConsentLine({ offerMinor: 7_600_000, proceedsMinor: 6_232_000, commissionBps: 1500 }),
    ).toBe(
      "You receive £62,320.00: the offer of £76,000.00 less your 15% commission and VAT, under your signed agreement.",
    );
  });
});
