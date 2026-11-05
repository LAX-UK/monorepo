import { describe, expect, it } from "vitest";
import {
  buildPurchaseProblemsChips,
  hasPurchaseProblemsFilters,
  parsePurchaseProblemsSearch,
  purchaseProblemHref,
  purchaseProblemsApiQuery,
  purchaseProblemsHref,
  purchaseProblemsPagination,
} from "./purchase-problems-search";

const SALE = "0f3c9a1e-7b4d-4e0a-9d1f-5c6b7a8e9f00";

describe("parsePurchaseProblemsSearch", () => {
  it("opens on Open, page one, with nothing filtered", () => {
    expect(parsePurchaseProblemsSearch({})).toEqual({
      status: "open",
      q: "",
      saleId: "",
      assignee: "",
      page: 1,
    });
  });

  it("reads a valid status, sale, owner, search and page", () => {
    expect(
      parsePurchaseProblemsSearch({
        status: "in_progress",
        sale: SALE,
        assignee: "unassigned",
        q: " ada ",
        page: "3",
      }),
    ).toEqual({ status: "in_progress", saleId: SALE, assignee: "unassigned", q: "ada", page: 3 });
  });

  it("ignores values it does not recognise", () => {
    expect(
      parsePurchaseProblemsSearch({ status: "closed", sale: "not-a-uuid", page: "-4" }),
    ).toMatchObject({ status: "open", saleId: "", page: 1 });
  });
});

describe("filters and the API query", () => {
  it("treats a search, sale or owner as filtering, and the tab alone as not", () => {
    expect(hasPurchaseProblemsFilters(parsePurchaseProblemsSearch({ status: "resolved" }))).toBe(
      false,
    );
    expect(hasPurchaseProblemsFilters(parsePurchaseProblemsSearch({ q: "ada" }))).toBe(true);
    expect(hasPurchaseProblemsFilters(parsePurchaseProblemsSearch({ sale: SALE }))).toBe(true);
  });

  it("sends only what is set", () => {
    const query = purchaseProblemsApiQuery(
      parsePurchaseProblemsSearch({ status: "resolved", sale: SALE, q: "ada", page: "2" }),
    );
    expect(Object.fromEntries(query)).toEqual({
      status: "resolved",
      saleId: SALE,
      q: "ada",
      page: "2",
      limit: "25",
    });
    expect(purchaseProblemsApiQuery(parsePurchaseProblemsSearch({})).has("q")).toBe(false);
  });
});

describe("hrefs", () => {
  it("returns to page one when a filter changes and keeps Open out of the URL", () => {
    expect(purchaseProblemsHref({ page: "3", status: "resolved" }, { q: "ada" })).toBe(
      "/admin/purchase-problems?status=resolved&q=ada",
    );
    expect(purchaseProblemsHref({ status: "resolved" }, { status: "open" })).toBe(
      "/admin/purchase-problems",
    );
  });

  it("opens a report by its id, encoded", () => {
    expect(purchaseProblemHref("a b")).toBe("/admin/purchase-problems/a%20b");
  });
});

describe("chips", () => {
  it("offers one removable chip per filter that is on", () => {
    const filters = parsePurchaseProblemsSearch({ sale: SALE, assignee: "u-1" });
    const chips = buildPurchaseProblemsChips(
      filters,
      { sale: SALE, assignee: "u-1" },
      {
        sale: () => "Autumn",
        assignee: () => "Sofia",
      },
    );
    expect(chips).toEqual([
      { id: "sale", label: "Sale: Autumn", clearHref: "/admin/purchase-problems?assignee=u-1" },
      { id: "assignee", label: "Owner: Sofia", clearHref: `/admin/purchase-problems?sale=${SALE}` },
    ]);
  });
});

describe("purchaseProblemsPagination", () => {
  it("links to the page before and after", () => {
    expect(purchaseProblemsPagination({ page: "2" }, { page: 2, pageSize: 25, total: 80 })).toEqual(
      {
        prevHref: "/admin/purchase-problems",
        nextHref: "/admin/purchase-problems?page=3",
      },
    );
  });

  it("has no next link on the last page and no previous on the first", () => {
    expect(purchaseProblemsPagination({}, { page: 1, pageSize: 25, total: 25 })).toEqual({
      prevHref: null,
      nextHref: null,
    });
    expect(
      purchaseProblemsPagination({ page: "3" }, { page: 3, pageSize: 25, total: 60 }).prevHref,
    ).toBe("/admin/purchase-problems?page=2");
  });
});
