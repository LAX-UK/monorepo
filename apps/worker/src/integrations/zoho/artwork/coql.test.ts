import { describe, expect, it } from "vitest";
import {
  escapeCoqlString,
  formatCoqlTime,
  productByIdQuery,
  productsModifiedSinceQuery,
} from "./coql.js";

describe("coql builders", () => {
  it("formats times in UTC without a fraction", () => {
    expect(formatCoqlTime(new Date("2026-11-03T02:30:15.123Z"))).toBe("2026-11-03T02:30:15+00:00");
  });

  it("builds the changed-since query with the required ordering and paging", () => {
    expect(productsModifiedSinceQuery(new Date("2026-11-03T02:30:15.000Z"), 400)).toBe(
      "select id, Product_Name, Reference_Stock_Code, Artist, Medium, Dimensions, Status, Year, Unit_Price, Modified_Time from Products where Modified_Time > '2026-11-03T02:30:15+00:00' order by Modified_Time limit 400, 200",
    );
  });

  it("escapes quotes in a Product id", () => {
    expect(escapeCoqlString("a'b\\c")).toBe("a\\'b\\\\c");
    expect(productByIdQuery("1' or '1'='1")).toContain("where id = '1\\' or \\'1\\'=\\'1'");
  });
});
