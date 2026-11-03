import { groupBidderAttention } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  type ClientAttention,
  NO_ATTENTION,
  attentionChip,
  attentionCountFor,
} from "./client-attention";

function attention(overrides: Partial<ClientAttention> = {}): ClientAttention {
  return { ...NO_ATTENTION, ...overrides };
}

describe("attentionChip", () => {
  it("shows nothing when nothing is pressing", () => {
    expect(attentionChip(NO_ATTENTION)).toBeNull();
  });

  it("names the work when one lot is outbid, and links to its price block", () => {
    const groups = groupBidderAttention([
      { kind: "outbid", lotId: "l1", title: "Harbour at Dawn" },
    ]);
    expect(attentionChip(attention({ outbidLots: ["14"], groups }))).toEqual({
      kind: "outbid",
      label: "Outbid on Harbour at Dawn",
      href: "/lot/harbour-at-dawn/l1#price",
      accessibleName: "Outbid on Harbour at Dawn. Go to the lot",
    });
  });

  it("counts lots and links to My bids when several are outbid", () => {
    const groups = groupBidderAttention([
      { kind: "outbid", lotId: "l1", title: "Harbour at Dawn" },
      { kind: "outbid", lotId: "l2", title: "Estuary, evening" },
    ]);
    expect(attentionChip(attention({ outbidLots: ["14", "22"], groups }))).toMatchObject({
      label: "Outbid on 2 lots",
      href: "/bids?tab=active",
      accessibleName: "Outbid on 2 lots. Go to My bids",
    });
  });

  it("falls back to a count when the lots could not be named", () => {
    expect(attentionChip(attention({ outbidLots: [null] }))?.label).toBe("Outbid on 1 lot");
  });

  it("asks for payment when nothing is outbid", () => {
    expect(attentionChip(attention({ paymentsDue: 2 }))).toMatchObject({
      kind: "payment-due",
      label: "Payment due",
      href: "/purchases",
    });
  });

  it("says the account is in review, not that payment is due, while checks are open", () => {
    expect(attentionChip(attention({ paymentsDue: 3, paymentsInReview: true }))).toMatchObject({
      kind: "account-in-review",
      label: "Account in review",
      href: "/purchases",
      accessibleName: "Account in review. Go to Purchases",
    });
  });

  it("still counts what is owed in the menu while the account is in review", () => {
    expect(
      attentionCountFor("purchases", attention({ paymentsDue: 3, paymentsInReview: true })),
    ).toMatchObject({ value: 3, label: "3 to pay" });
  });

  it("lets outbid win while a sale is live", () => {
    expect(attentionChip(attention({ outbidLots: ["8"], paymentsDue: 1 }))?.kind).toBe("outbid");
  });

  it("never prompts for unread notifications alone (the bell has them)", () => {
    expect(attentionChip(attention({ unreadNotifications: 5 }))).toBeNull();
  });
});

describe("attentionCountFor", () => {
  const due = attention({ outbidLots: ["14"], paymentsDue: 2, unreadNotifications: 3 });

  it("counts outbid bids as urgent", () => {
    expect(attentionCountFor("bids", due)).toEqual({
      value: 1,
      tone: "danger",
      label: "1 outbid",
      menuStyle: "badge",
    });
  });

  it("counts purchases to pay in words for the menu", () => {
    expect(attentionCountFor("purchases", due)).toMatchObject({
      value: 2,
      tone: "neutral",
      label: "2 to pay",
      menuStyle: "text",
    });
  });

  it("counts unread notifications", () => {
    expect(attentionCountFor("notifications", due)?.label).toBe("3 unread");
  });

  it("has no count for pages where nothing can be due, or when nothing is", () => {
    expect(attentionCountFor("watchlist", due)).toBeNull();
    expect(attentionCountFor("bids", NO_ATTENTION)).toBeNull();
  });
});
