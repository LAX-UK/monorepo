import { describe, expect, it } from "vitest";
import {
  type ClientAttention,
  NO_ATTENTION,
  attentionChip,
  attentionCountFor,
  attentionTasks,
} from "./client-attention";

function attention(overrides: Partial<ClientAttention> = {}): ClientAttention {
  return { ...NO_ATTENTION, ...overrides };
}

describe("attentionChip", () => {
  it("shows nothing when nothing is pressing", () => {
    expect(attentionChip(NO_ATTENTION)).toBeNull();
  });

  it("names the lot when one bid is outbid", () => {
    expect(attentionChip(attention({ outbidLots: ["14"] }))).toEqual({
      kind: "outbid",
      label: "Outbid on lot 14",
      shortLabel: "Outbid",
      href: "/bids?tab=active",
    });
  });

  it("counts lots when several are outbid, or one has no number yet", () => {
    expect(attentionChip(attention({ outbidLots: ["14", "22"] }))?.label).toBe("Outbid on 2 lots");
    expect(attentionChip(attention({ outbidLots: [null] }))?.label).toBe("Outbid on 1 lot");
  });

  it("asks for payment when nothing is outbid", () => {
    expect(attentionChip(attention({ paymentsDue: 2 }))).toMatchObject({
      kind: "payment-due",
      label: "Payment due",
      href: "/purchases",
    });
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

describe("attentionTasks", () => {
  it("lists nothing when nothing is due", () => {
    expect(attentionTasks(NO_ATTENTION)).toEqual([]);
  });

  it("lists every prompt the chip could show, outbid first, so Needs action is never empty beside it", () => {
    expect(attentionTasks(attention({ outbidLots: ["2"], paymentsDue: 2 }))).toEqual([
      {
        kind: "outbid",
        title: "Outbid on lot 2",
        actionLabel: "Review your bids",
        href: "/bids?tab=active",
      },
      {
        kind: "payment-due",
        title: "2 purchases to pay",
        actionLabel: "Go to purchases",
        href: "/purchases",
      },
    ]);
  });
});
