import { describe, expect, it } from "vitest";
import { PRIVATE_SALES_REDIRECTS } from "./private-sales-redirects";

describe("PRIVATE_SALES_REDIRECTS", () => {
  it("sends every retired address to the enquiry page with a 301", () => {
    expect(PRIVATE_SALES_REDIRECTS.map((r) => [r.source, r.destination, r.statusCode])).toEqual([
      ["/sales", "/sell/private-sales", 301],
      ["/contact", "/sell/private-sales", 301],
    ]);
  });

  it("matches the calendar tab in any letter case", () => {
    const tab = PRIVATE_SALES_REDIRECTS[0]?.has[0]?.value ?? "";
    const re = new RegExp(`^${tab}$`);
    for (const v of ["privatesales", "privateSales", "PrivateSales"]) expect(re.test(v)).toBe(true);
    expect(re.test("results")).toBe(false);
  });
});
