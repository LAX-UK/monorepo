import { type SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  publicCatalogueLotCondition,
  publicLotCondition,
  publicSaleCondition,
  saleIsAtgOwnedSql,
} from "./atg-public-catalog.sql.js";

const dialect = new PgDialect();
const render = (condition: SQL) => dialect.sqlToQuery(condition).sql;

describe("public catalogue SQL leaves test sales out", () => {
  it("excludes a test sale from the public sale condition", () => {
    expect(render(publicSaleCondition())).toMatch(/"sale"\."is_test" = \$\d/);
  });

  it("excludes the lots of a test sale from the public lot conditions", () => {
    for (const condition of [publicLotCondition(), publicCatalogueLotCondition()]) {
      expect(render(condition)).toContain("test_sale.is_test = true");
    }
  });

  it("never treats an ATG-owned draft test sale as public", () => {
    expect(render(saleIsAtgOwnedSql(sql`s.id`))).toContain("test_sale.is_test = true");
  });
});
