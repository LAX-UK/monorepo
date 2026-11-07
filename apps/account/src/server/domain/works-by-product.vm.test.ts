import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { buildWorksByProduct } from "./works-by-product.vm";

const works = (product: "bid" | "shop" | "art", count: number) =>
  Array.from({ length: count }, (_, index) => item({ product, id: `${product}-${index}` }));

describe("buildWorksByProduct", () => {
  it("ranks products by count, scales the bars and keeps a zero product last", () => {
    const chart = buildWorksByProduct([...works("shop", 23), ...works("bid", 5)]);
    expect(
      chart?.bars.map((bar) => [bar.label, bar.status === "counted" ? bar.count : null]),
    ).toEqual([
      ["LAX Shop", 23],
      ["LAX Bid", 5],
      ["lax.art", 0],
    ]);
    const [shop, bid, art] = chart?.bars ?? [];
    expect(shop).toMatchObject({ widthPercent: 100 });
    expect(bid).toMatchObject({ widthPercent: (5 / 23) * 100 });
    expect(art).toMatchObject({ widthPercent: 0 });
  });

  it("is hidden when fewer than two products hold works", () => {
    expect(buildWorksByProduct(works("bid", 4))).toBeNull();
    expect(buildWorksByProduct([])).toBeNull();
  });

  it("shows from two products up", () => {
    expect(buildWorksByProduct([...works("bid", 1), ...works("art", 1)])).not.toBeNull();
  });

  it("names a product that did not answer instead of inventing a count", () => {
    const chart = buildWorksByProduct([...works("bid", 5), ...works("art", 2)], ["shop"]);
    expect(chart?.bars.at(-1)).toEqual({
      product: "shop",
      label: "LAX Shop",
      status: "unanswered",
    });
    expect(chart?.bars.slice(0, -1).map((bar) => bar.label)).toEqual(["LAX Bid", "lax.art"]);
  });
});
