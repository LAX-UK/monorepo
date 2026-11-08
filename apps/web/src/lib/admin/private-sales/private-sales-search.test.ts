import { describe, expect, it } from "vitest";
import {
  type DealsFilters,
  dealsApiQuery,
  dealsHref,
  dealsPagination,
  parseDealsSearch,
} from "./private-sales-search";

describe("parseDealsSearch", () => {
  it("opens on the active view", () => {
    expect(parseDealsSearch({})).toEqual({ view: "active", cursor: "", trail: [] });
  });

  it("takes a view that exists and ignores one that does not", () => {
    expect(parseDealsSearch({ view: "payment_due" }).view).toBe("payment_due");
    expect(parseDealsSearch({ view: "mine" }).view).toBe("active");
  });

  it("keeps a sensible trail and drops a broken one", () => {
    expect(parseDealsSearch({ trail: JSON.stringify(["", "abc"]) }).trail).toEqual(["", "abc"]);
    expect(parseDealsSearch({ trail: "{nope" }).trail).toEqual([]);
    expect(parseDealsSearch({ trail: JSON.stringify([1, "ok"]) }).trail).toEqual(["ok"]);
  });
});

describe("dealsApiQuery", () => {
  it("carries the view, the page size and the cursor", () => {
    const query = dealsApiQuery({ view: "settled", cursor: "abc", trail: [] });
    expect(query.get("view")).toBe("settled");
    expect(query.get("limit")).toBe("25");
    expect(query.get("cursor")).toBe("abc");
  });
});

describe("dealsHref", () => {
  it("keeps the landing view out of the address and returns to the first page", () => {
    expect(dealsHref({ view: "settled", cursor: "x" }, { view: "active" })).toBe(
      "/admin/private-sales",
    );
    expect(dealsHref({}, { view: "cancelled" })).toBe("/admin/private-sales?view=cancelled");
  });
});

describe("dealsPagination", () => {
  const filters: DealsFilters = { view: "active", cursor: "", trail: [] };

  it("shows nothing for an empty page", () => {
    expect(dealsPagination({}, filters, { itemCount: 0, nextCursor: null })).toBeNull();
  });

  it("counts a single page plainly", () => {
    expect(dealsPagination({}, filters, { itemCount: 1, nextCursor: null })?.summary).toBe(
      "1 deal",
    );
    expect(dealsPagination({}, filters, { itemCount: 3, nextCursor: null })?.summary).toBe(
      "3 deals",
    );
  });

  it("links forward and back through the trail", () => {
    const first = dealsPagination({}, filters, { itemCount: 25, nextCursor: "c1" });
    expect(first?.prevHref).toBeNull();
    expect(first?.nextHref).toContain("cursor=c1");
    const second = dealsPagination(
      { cursor: "c1", trail: JSON.stringify([""]) },
      { view: "active", cursor: "c1", trail: [""] },
      { itemCount: 10, nextCursor: null },
    );
    expect(second?.summary).toBe("Page 2 · 10 deals");
    expect(second?.prevHref).toBe("/admin/private-sales");
    expect(second?.nextHref).toBeNull();
  });
});
