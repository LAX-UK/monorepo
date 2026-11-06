import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { buildPortfolioPage } from "./portfolio-page.vm";

describe("buildPortfolioPage", () => {
  it("welcomes a new collector only when every product answered", () => {
    expect(buildPortfolioPage([], {}, true).emptyState).toBe("new_collector");
    expect(buildPortfolioPage([], {}, false).emptyState).toBeNull();
  });

  it("filters the holdings but counts the summary over every work", () => {
    const items = [
      item({ id: "1", status: "owned", product: "bid" }),
      item({ id: "2", status: "in_sale", product: "shop" }),
    ];
    const vm = buildPortfolioPage(items, { products: ["shop"] }, true);
    expect(vm.holdings.rows.map((row) => row.item.id)).toEqual(["2"]);
    expect(vm.collection.counts.map((count) => [count.key, count.value])).toEqual([
      ["owned", 1],
      ["in-sale", 1],
    ]);
  });

  it("surfaces attention rows from all works", () => {
    const vm = buildPortfolioPage([item({ status: "payout_pending" })], {}, true);
    expect(vm.attention).toHaveLength(1);
  });

  it("charts works by product over every work, and names a product that did not answer", () => {
    const items = [
      item({ id: "1", product: "bid" }),
      item({ id: "2", product: "shop" }),
      item({ id: "3", product: "shop" }),
    ];
    const vm = buildPortfolioPage(items, { products: ["bid"] }, true, ["art"]);
    expect(vm.worksByProduct?.bars.map((bar) => [bar.product, bar.status])).toEqual([
      ["shop", "counted"],
      ["bid", "counted"],
      ["art", "unanswered"],
    ]);
  });

  it("leaves the chart out when only one product holds works", () => {
    expect(buildPortfolioPage([item({ product: "bid" })], {}, true).worksByProduct).toBeNull();
  });
});
