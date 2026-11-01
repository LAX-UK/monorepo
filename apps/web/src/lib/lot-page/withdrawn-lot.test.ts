import { describe, expect, it } from "vitest";
import { buildWithdrawnLotView, parseWithdrawnLot } from "./withdrawn-lot";

const ROW = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 4,
  title: "Estuary, evening",
  description: "Painted from the sea wall.",
  medium: "Oil on canvas",
  dimensions: "90 x 120 cm",
  images: ["a.jpg"],
  artistId: "a1",
  auctionType: "english",
  status: "withdrawn",
};

describe("parseWithdrawnLot", () => {
  it("reads the slim public row", () => {
    expect(parseWithdrawnLot(ROW)).toMatchObject({
      id: "lot-1",
      saleId: "sale-1",
      lotNumber: 4,
      title: "Estuary, evening",
      images: ["a.jpg"],
      artistId: "a1",
    });
  });

  it("is null for any other lot", () => {
    expect(parseWithdrawnLot({ ...ROW, status: "active" })).toBeNull();
    expect(parseWithdrawnLot(null)).toBeNull();
    expect(parseWithdrawnLot({ status: "withdrawn" })).toBeNull();
  });
});

describe("buildWithdrawnLotView", () => {
  it("has the notice and the way back, and no price, timing, history or actions", () => {
    const view = buildWithdrawnLotView(new Date("2026-11-02T12:00:00Z"));
    expect(view.withdrawn).toBe(true);
    expect(view.badge.label).toBe("Withdrawn");
    expect(view.price.amountText).toBeNull();
    expect(view.price.subLine).toBe("This lot was withdrawn from the sale");
    expect(view.rows).toEqual([]);
    expect(view.sections).toEqual({ watchShare: false, history: false });
    expect(view.actionSurface).toBe("back_to_sale");
  });
});
