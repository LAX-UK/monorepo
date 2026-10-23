import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { buildPortfolioPage } from "./portfolio-page.vm";

describe("buildPortfolioPage", () => {
  it("welcomes a new collector only when every product answered", () => {
    expect(buildPortfolioPage([], {}, true).emptyState).toBe("new_collector");
    expect(buildPortfolioPage([], {}, false).emptyState).toBeNull();
  });

  it("filters the holdings but counts the header over every work", () => {
    const items = [
      item({ id: "1", status: "owned", product: "bid" }),
      item({ id: "2", status: "in_sale", product: "shop" }),
    ];
    const vm = buildPortfolioPage(items, { products: ["shop"] }, true);
    expect(vm.holdings.rows.map((row) => row.item.id)).toEqual(["2"]);
    expect(vm.header).toMatchObject({ worksOwned: 1, inSaleOrConsigned: 1 });
  });

  it("surfaces attention rows from all works", () => {
    const vm = buildPortfolioPage([item({ status: "payout_pending" })], {}, true);
    expect(vm.attention).toHaveLength(1);
  });
});
