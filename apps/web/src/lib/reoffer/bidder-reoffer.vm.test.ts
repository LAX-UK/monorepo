import type { BidderReofferView } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  bidderReofferRows,
  bidderReofferState,
  bidderReofferVm,
  endsInLabel,
} from "./bidder-reoffer.vm";

const NOW = new Date("2026-11-12T10:00:00Z");

const view = (over: Partial<BidderReofferView> = {}): BidderReofferView => ({
  id: "o1",
  lotId: "lot1",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  saleId: "s1",
  lotImage: null,
  lotEndedAt: "2026-10-29T17:00:00.000Z",
  status: "offered",
  price: {
    hammerMinor: 82_000_00,
    buyersPremiumMinor: 20_500_00,
    vatOnPremiumMinor: 4_100_00,
    vatOnLotMinor: null,
    artistsResaleRightMinor: null,
    totalMinor: 106_600_00,
  },
  endsAt: "2026-11-14T17:00:00.000Z",
  respondedAt: null,
  invoiceDueAt: null,
  ...over,
});

const viewer = {
  canAnswer: true,
  organisation: "Northbank Gallery",
  identityCheckPending: false,
  endedWhileAnswering: false,
  saleTitle: "Modern & Contemporary: Online",
};

describe("the state of an offer", () => {
  it("follows the record, and reads as ended once its time has passed even before the clock closes it", () => {
    expect(bidderReofferState(view(), NOW)).toBe("open");
    expect(bidderReofferState(view({ endsAt: "2026-11-12T09:59:00.000Z" }), NOW)).toBe("ended");
    expect(bidderReofferState(view({ status: "ended" }), NOW)).toBe("ended");
    expect(bidderReofferState(view({ status: "declined" }), NOW)).toBe("declined");
    expect(bidderReofferState(view({ status: "withdrawn" }), NOW)).toBe("withdrawn");
    expect(bidderReofferState(view({ status: "accepted" }), NOW)).toBe("accepted");
  });
});

describe("how long an offer has left", () => {
  it("is only said in the last day, in whole hours, then minutes", () => {
    expect(endsInLabel("2026-11-14T17:00:00.000Z", NOW)).toBeNull();
    expect(endsInLabel("2026-11-12T16:00:00.000Z", NOW)).toBe("Ends in 6 hours");
    expect(endsInLabel("2026-11-12T11:00:00.000Z", NOW)).toBe("Ends in 1 hour");
    expect(endsInLabel("2026-11-12T10:20:00.000Z", NOW)).toBe("Ends in 20 minutes");
    expect(endsInLabel("2026-11-12T09:00:00.000Z", NOW)).toBeNull();
  });
});

describe("the open offer", () => {
  const vm = bidderReofferVm(view(), viewer, NOW);

  it("says what is offered, at what price and until when, in the one date style", () => {
    expect(vm.chip).toEqual({ tone: "info", label: "Ends Sat 14 Nov, 17:00 GMT", cue: "clock" });
    expect(vm.card.lead?.amount).toBe("£82,000.00");
    expect(vm.lotMeta).toEqual(["Lot 2 · Modern & Contemporary: Online", "Ended Thu 29 Oct"]);
    expect(vm.subtitle).toBe("After the auction, at your bid");
    expect(vm.card.answerable).toBe(true);
  });

  it("shows each price line and the total before the bidder accepts, leaving out lines that do not apply", () => {
    expect(vm.price.rows).toEqual([
      { label: "Hammer (your bid)", value: "£82,000.00" },
      { label: "Buyer's premium", value: "£20,500.00" },
      { label: "VAT on the buyer's premium", value: "£4,100.00" },
      { label: "Total", value: "£106,600.00", strong: true },
    ]);
    const withLotTaxes = bidderReofferVm(
      view({
        price: {
          hammerMinor: 100,
          buyersPremiumMinor: 25,
          vatOnPremiumMinor: 5,
          vatOnLotMinor: 20,
          artistsResaleRightMinor: 4,
          totalMinor: 154,
        },
      }),
      viewer,
      NOW,
    );
    expect(withLotTaxes.price.rows.map((row) => row.label)).toEqual([
      "Hammer (your bid)",
      "Buyer's premium",
      "VAT on the buyer's premium",
      "VAT on the lot",
      "Artist's Resale Right",
      "Total",
    ]);
  });

  it("says how long is left only in the last day", () => {
    expect(vm.endsIn).toBeNull();
    const soon = bidderReofferVm(view({ endsAt: "2026-11-12T16:00:00.000Z" }), viewer, NOW);
    expect(soon.endsIn).toBe("Ends in 6 hours");
  });

  it("lets the bidder accept while an identity check is still to pass, and says it comes after", () => {
    const pending = bidderReofferVm(view(), { ...viewer, identityCheckPending: true }, NOW);
    expect(pending.card.answerable).toBe(true);
    expect(pending.card.notice).toMatchObject({
      tone: "warning",
      title: "You'll need to verify your identity to pay",
    });
  });

  it("gives a member who may not bid for the account the offer without the answers", () => {
    const readOnly = bidderReofferVm(view(), { ...viewer, canAnswer: false }, NOW);
    expect(readOnly.card.answerable).toBe(false);
    expect(readOnly.card.notice?.title).toBe(
      "Only members who can bid for Northbank Gallery can answer",
    );
  });

  it("does not name a sale it could not read", () => {
    expect(bidderReofferVm(view(), { ...viewer, saleTitle: null }, NOW).lotMeta[0]).toBe("Lot 2");
  });
});

describe("an offer that is over", () => {
  it("ended: says nothing is owed, and a late accept adds the danger notice", () => {
    const ended = view({ status: "ended" });
    const plain = bidderReofferVm(ended, viewer, NOW);
    expect(plain.card).toMatchObject({
      state: "ended",
      heading: "This offer has ended",
      answerable: false,
      browse: true,
      notice: null,
    });
    expect(plain.card.paragraphs[0]).toContain("You don't owe anything.");
    const late = bidderReofferVm(ended, { ...viewer, endedWhileAnswering: true }, NOW);
    expect(late.card.notice).toEqual({
      tone: "danger",
      title: "This offer has ended",
      detail: "It can no longer be accepted. Nothing has been charged.",
    });
  });

  it("declined and withdrawn: each says so and owes nothing", () => {
    expect(bidderReofferVm(view({ status: "declined" }), viewer, NOW).card.heading).toBe(
      "You declined this offer",
    );
    expect(bidderReofferVm(view({ status: "withdrawn" }), viewer, NOW).card.heading).toBe(
      "This offer has been withdrawn",
    );
  });

  it("accepted: leads to the purchase, with the invoice's due date", () => {
    const accepted = bidderReofferVm(
      view({
        status: "accepted",
        respondedAt: "2026-11-12T09:00:00.000Z",
        invoiceDueAt: "2026-11-19T23:59:59.999Z",
      }),
      viewer,
      NOW,
    );
    expect(accepted.chip?.label).toBe("Accepted");
    expect(accepted.card.heading).toBe("You bought this lot");
    expect(accepted.card.paragraphs[0]).toContain("£106,600.00 is due by Thu 19 Nov, 23:59 GMT");
    expect(accepted.card.purchaseHref).toBe("/purchases/lot1");
    expect(accepted.card.answerable).toBe(false);
  });
});

describe("the offers pinned above Bids", () => {
  it("lists only the open offers, the one ending soonest first", () => {
    const rows = bidderReofferRows(
      [
        view({ id: "later", endsAt: "2026-11-15T17:00:00.000Z" }),
        view({ id: "closed", status: "declined" }),
        view({ id: "gone", endsAt: "2026-11-11T17:00:00.000Z" }),
        view({ id: "soon", endsAt: "2026-11-13T17:00:00.000Z", lotTitle: "Harbour" }),
      ],
      NOW,
      { s1: "Online sale" },
    );
    expect(rows.map((row) => row.id)).toEqual(["soon", "later"]);
    expect(rows[0]).toMatchObject({
      href: "/bids/offers/soon",
      title: "Harbour",
      meta: ["Lot 2 · Online sale"],
      offerLabel: "£82,000.00",
      ends: "Ends Fri 13 Nov, 17:00 GMT",
    });
  });
});
