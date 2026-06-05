import { describe, expect, it } from "vitest";
import { formatGbp, lotHref, slugifyTitle } from "./sale-catalog-api.js";

describe("sale-catalog-api", () => {
  it("slugifyTitle builds marketing lot paths", () => {
    expect(slugifyTitle("Love Rat by Banksy")).toBe("love-rat-by-banksy");
  });

  it("lotHref builds canonical lot detail paths", () => {
    expect(lotHref({ id: "lot-id", title: "Memory Garden" })).toMatch(
      /\/lot\/memory-garden\/lot-id$/,
    );
  });

  it("formatGbp formats whole pounds", () => {
    expect(formatGbp("17952")).toBe("£17,952");
    expect(formatGbp("1.00", { decimals: 0 })).toBe("£1");
  });
});
