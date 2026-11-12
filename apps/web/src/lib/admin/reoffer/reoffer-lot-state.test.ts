import { describe, expect, it } from "vitest";
import { BUYER_DEFAULT, PREVIEW, offer } from "./reoffer-fixtures";
import { offerPriceTile, openOffer, reofferHeader, showsReofferCard } from "./reoffer-lot-state";

const ready = (offers = [offer()], buyerDefault: typeof BUYER_DEFAULT | null = BUYER_DEFAULT) =>
  ({ status: "ready", buyerDefault, offers, preview: PREVIEW }) as const;
const waiting = { status: "ended", hasWinner: false };

describe("the lot after a buyer default", () => {
  it("shows the card for a lot waiting for a buyer, and for any lot with offers", () => {
    expect(showsReofferCard(ready([]), waiting)).toBe(true);
    expect(showsReofferCard(ready(), { status: "ended", hasWinner: true })).toBe(true);
  });

  it("shows no card without a default, or for a lot already back in inventory", () => {
    expect(showsReofferCard(ready([], null), waiting)).toBe(false);
    expect(showsReofferCard(ready([]), { status: "draft", hasWinner: false })).toBe(false);
  });

  it("reads Buyer default in the header, with the offer's state beside it", () => {
    expect(reofferHeader(ready(), waiting)).toEqual({
      badge: { label: "Buyer default", tone: "danger" },
      meta: "waiting for the seller",
    });
  });

  it("changes nothing once the lot has a buyer again, and nothing when the load failed", () => {
    const sold = reofferHeader(ready([offer({ status: "accepted" })]), {
      status: "ended",
      hasWinner: true,
    });
    expect(sold.badge).toBeNull();
    expect(sold.meta).toBe("accepted");
    expect(reofferHeader({ status: "failed" }, waiting)).toEqual({ badge: null, meta: null });
  });

  it("finds the open offer and puts the offer price where the current bid was", () => {
    const open = offer();
    expect(openOffer([offer({ status: "declined" }), open])).toBe(open);
    expect(openOffer([offer({ status: "declined" })])).toBeNull();
    const tiles = [
      { id: "estimate", label: "Estimate", value: "£1" },
      { id: "current-bid", label: "Current bid", value: "£88,000.00" },
    ];
    expect(offerPriceTile(tiles, open)).toEqual([
      tiles[0],
      { id: "current-bid", label: "Offer price", value: "£82,000.00" },
    ]);
    expect(offerPriceTile(tiles, null)).toEqual(tiles);
  });
});
