import { shopArtwork, shopCategory, shopOrder } from "@auction/db/schema";
import { type SQL, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { orderLineCountSql } from "./admin-client-commerce.js";
import { artworkEditionCountSql, artworkSoldEditionCountSql } from "./artwork-visibility-sql.js";
import { categoryEditionCountSql } from "./home-features/drizzle-home-feature.reader.js";

const db = drizzle.mock();

/** A one-table select prints the select-list columns bare, which a subquery would read as its own. */
function selectListOf(
  fragment: SQL,
  table: typeof shopOrder | typeof shopCategory | typeof shopArtwork,
) {
  return db.select({ value: fragment }).from(table).where(eq(table.id, "any")).toSQL().sql;
}

describe("correlated subqueries in a select list", () => {
  it("count a client's order lines against the order, not against the line's own id", () => {
    expect(selectListOf(orderLineCountSql, shopOrder)).toContain('"order_id" = "shop_order"."id"');
  });

  it("count a category's editions against the category", () => {
    expect(selectListOf(categoryEditionCountSql, shopCategory)).toContain(
      '"category_id" = "shop_category"."id"',
    );
  });

  it("count an artwork's editions against the artwork", () => {
    for (const fragment of [artworkEditionCountSql, artworkSoldEditionCountSql]) {
      expect(selectListOf(fragment, shopArtwork)).toContain('"artwork_id" = "shop_artwork"."id"');
    }
  });
});
