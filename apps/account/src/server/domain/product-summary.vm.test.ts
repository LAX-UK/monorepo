import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { buildProductSummaries, unansweredSummaries } from "./product-summary.vm";

type Product = "bid" | "shop" | "art";
const works = (product: Product, count: number, status: Parameters<typeof item>[0] = {}) =>
  Array.from({ length: count }, (_, index) =>
    item({ product, id: `${product}-${status.status}-${index}`, ...status }),
  );

describe("buildProductSummaries", () => {
  it("counts editions for LAX Shop and mentions what is on its way", () => {
    const rows = [...works("shop", 22), ...works("shop", 1, { status: "awaiting_shipment" })];
    expect(buildProductSummaries(rows).shop).toEqual({
      status: "counted",
      line: "23 editions · 1 on its way",
    });
  });

  it("counts works for LAX Bid with what to pay and what is consigned", () => {
    const rows = [
      ...works("bid", 3),
      ...works("bid", 1, { status: "awaiting_payment" }),
      ...works("bid", 1, { status: "consigned" }),
    ];
    expect(buildProductSummaries(rows).bid).toEqual({
      status: "counted",
      line: "5 works · 1 to pay · 1 consigned",
    });
  });

  it("uses the singular for one", () => {
    expect(buildProductSummaries(works("art", 1)).art).toEqual({
      status: "counted",
      line: "1 work",
    });
  });

  it("marks a product with no works as empty so the card invites instead", () => {
    const summaries = buildProductSummaries(works("bid", 2));
    expect(summaries.art).toEqual({ status: "empty" });
    expect(summaries.shop).toEqual({ status: "empty" });
  });

  it("keeps counts for products that answered when another did not", () => {
    const summaries = buildProductSummaries(works("bid", 2), ["shop", "art"]);
    expect(summaries.bid.status).toBe("counted");
    expect(summaries.shop).toEqual({ status: "unanswered" });
    expect(summaries.art).toEqual({ status: "unanswered" });
  });

  it("never invents a count when nothing could be read", () => {
    expect(Object.values(unansweredSummaries()).every((s) => s.status === "unanswered")).toBe(true);
  });
});
