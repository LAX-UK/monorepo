import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { catalogSalePageOrderBy, listOrderBy, shownPriceOrder } from "./lot-list-filters.js";

/**
 * Price sorts order a lot by the price the public reads. An open sealed lot shows its starting
 * price, so it must sort by that too: ordering by the stored current price would rank its hidden
 * bids against each other.
 */
describe("price sort order", () => {
  const dialect = new PgDialect();
  const render = (expr: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(expr).sql;
  const SEALED_OPEN_BRANCH =
    /case when "lot"\."status" = 'active' and "lot"\."auction_type" = 'sealed' then "lot"\."starting_price"/;

  it("orders an open sealed lot by its starting price", () => {
    expect(render(shownPriceOrder)).toMatch(SEALED_OPEN_BRANCH);
  });

  it.each(["priceAsc", "priceDesc"] as const)(
    "uses that price on the sale page sort %s",
    (sort) => {
      const [, byPrice] = catalogSalePageOrderBy(sort);
      if (!byPrice) throw new Error("expected a price term");
      expect(render(byPrice)).toMatch(SEALED_OPEN_BRANCH);
    },
  );

  it("uses that price on the hammerDesc list sort", () => {
    expect(render(listOrderBy("hammerDesc"))).toMatch(SEALED_OPEN_BRANCH);
  });
});
