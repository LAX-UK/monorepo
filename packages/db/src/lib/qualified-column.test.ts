import { type SQL, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { lot, sale } from "../schema/index.js";
import { qualifiedColumn } from "./qualified-column.js";

const db = drizzle.mock();

/** A single-table select prints its own select-list columns bare, which is where the bug shows. */
function singleTableSelectList(fragment: SQL): string {
  return db.select({ value: fragment }).from(sale).where(eq(sale.id, "someone")).toSQL().sql;
}

describe("qualifiedColumn", () => {
  it("prints the table name, so the subquery cannot read its own column of the same name", () => {
    const bare = singleTableSelectList(sql`(select 1 from ${lot} l where l.sale_id = ${sale.id})`);
    expect(bare).toContain('l.sale_id = "id"');

    const qualified = singleTableSelectList(
      sql`(select 1 from ${lot} l where l.sale_id = ${qualifiedColumn(sale.id)})`,
    );
    expect(qualified).toContain('l.sale_id = "sale"."id"');
  });

  it("leaves a fragment that is not a column untouched", () => {
    const fragment = sql`now()`;
    expect(qualifiedColumn(fragment)).toBe(fragment);
  });
});
