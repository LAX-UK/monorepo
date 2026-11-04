import { describe, expect, it } from "vitest";
import {
  buildDataRequestsChips,
  dataRequestHref,
  dataRequestsApiQuery,
  dataRequestsHref,
  hasDataRequestsFilters,
  listSearchFromRecordSearch,
  parseDataRequestsSearch,
} from "./data-requests-search";
import { paginationFor } from "./load-data-requests-page";

describe("parseDataRequestsSearch", () => {
  it("opens on Open, sorted by due date, with no filters", () => {
    expect(parseDataRequestsSearch({})).toEqual({
      view: "open",
      status: "",
      kind: "",
      product: "",
      q: "",
      sort: "due",
      cursor: "",
      trail: [],
    });
  });

  it("ignores values it does not know", () => {
    const filters = parseDataRequestsSearch({
      view: "everything",
      status: "nope",
      kind: "nope",
      product: "lax",
      sort: "sideways",
    });
    expect(filters).toMatchObject({ view: "open", status: "", kind: "", product: "", sort: "due" });
  });

  it("reads the view, filters, search and sort", () => {
    const filters = parseDataRequestsSearch({
      view: "overdue",
      status: "failed",
      kind: "full_copy",
      product: "bid",
      q: " DR-0012 ",
      sort: "requested",
    });
    expect(filters).toMatchObject({
      view: "overdue",
      status: "failed",
      kind: "full_copy",
      product: "bid",
      q: "DR-0012",
      sort: "requested",
    });
    expect(hasDataRequestsFilters(filters)).toBe(true);
    expect(hasDataRequestsFilters(parseDataRequestsSearch({ view: "closed" }))).toBe(false);
  });

  it("survives a broken trail", () => {
    expect(parseDataRequestsSearch({ trail: "not json" }).trail).toEqual([]);
    expect(parseDataRequestsSearch({ trail: JSON.stringify(["", "c1", 4]) }).trail).toEqual([
      "",
      "c1",
    ]);
  });
});

describe("hrefs", () => {
  it("keeps the default view and order out of the address", () => {
    expect(dataRequestsHref({ view: "overdue" }, { view: "open" })).toBe(
      "/admin/compliance/data-requests",
    );
    expect(dataRequestsHref({}, { sort: "due" })).toBe("/admin/compliance/data-requests");
    expect(dataRequestsHref({}, { sort: "requested" })).toBe(
      "/admin/compliance/data-requests?sort=requested",
    );
  });

  it("returns to the first page whenever a filter changes", () => {
    expect(
      dataRequestsHref({ cursor: "c9", trail: '[""]', view: "closed" }, { q: "DR-0012" }),
    ).toBe("/admin/compliance/data-requests?view=closed&q=DR-0012");
  });

  it("carries the list into a record, so J and K stay in it", () => {
    const filters = parseDataRequestsSearch({ view: "overdue", q: "DR-0012" });
    const href = dataRequestHref("DR-0012", filters);
    expect(href).toBe("/admin/compliance/data-requests/DR-0012?view=overdue&sort=due&q=DR-0012");
    const back = listSearchFromRecordSearch(
      Object.fromEntries(new URL(href, "http://x").searchParams),
    );
    expect(back).toEqual(filters);
    expect(dataRequestHref("DR-0012", null)).toBe("/admin/compliance/data-requests/DR-0012");
    expect(listSearchFromRecordSearch({})).toBeNull();
  });

  it("builds the API query from the filters", () => {
    const query = dataRequestsApiQuery(
      parseDataRequestsSearch({ view: "waiting", product: "shop", cursor: "abc", q: "a@b.co" }),
    );
    expect(Object.fromEntries(query)).toEqual({
      view: "waiting",
      sort: "due",
      product: "shop",
      q: "a@b.co",
      cursor: "abc",
    });
  });
});

describe("chips", () => {
  it("has one removable chip per filter, worded as the toolbar reads", () => {
    const sp = { status: "failed", product: "bid", q: "DR-0012" };
    const chips = buildDataRequestsChips(parseDataRequestsSearch(sp), sp, {
      status: (v) => v.toUpperCase(),
      kind: (v) => v,
      product: (v) => v,
    });
    expect(chips.map((chip) => chip.id)).toEqual(["q", "status", "product"]);
    expect(chips[1]?.label).toBe("Status: FAILED");
    expect(chips[1]?.clearHref).toBe("/admin/compliance/data-requests?product=bid&q=DR-0012");
  });
});

describe("cursor pagination", () => {
  const items = [{ reference: "DR-0001" }] as never;

  it("has no links on a single page", () => {
    const filters = parseDataRequestsSearch({});
    expect(paginationFor({}, filters, { items, nextCursor: null })).toEqual({
      summary: "1 request",
      prevHref: null,
      nextHref: null,
    });
  });

  it("links forward with the page it came from, and back to it", () => {
    const first = paginationFor({}, parseDataRequestsSearch({}), { items, nextCursor: "c1" });
    expect(first?.nextHref).toBe(
      `/admin/compliance/data-requests?cursor=c1&trail=${encodeURIComponent('[""]')}`,
    );
    const sp = { cursor: "c1", trail: '[""]' };
    const second = paginationFor(sp, parseDataRequestsSearch(sp), { items, nextCursor: "c2" });
    expect(second?.summary).toBe("Page 2 · 1 request");
    expect(second?.prevHref).toBe("/admin/compliance/data-requests");
    expect(second?.nextHref).toContain("cursor=c2");
  });

  it("has nothing to page when the list is empty", () => {
    expect(
      paginationFor({}, parseDataRequestsSearch({}), { items: [], nextCursor: null }),
    ).toBeNull();
  });
});
