import { describe, expect, it } from "vitest";
import {
  buildEnquiriesChips,
  enquiriesApiQuery,
  enquiriesHref,
  enquiriesPagination,
  enquiryHref,
  hasEnquiriesFilters,
  parseEnquiriesSearch,
} from "./enquiries-search";

describe("parseEnquiriesSearch", () => {
  it("lands on the person's own view when none is asked for", () => {
    expect(parseEnquiriesSearch({}, "assigned_to_me").view).toBe("assigned_to_me");
    expect(parseEnquiriesSearch({}, "open").view).toBe("open");
  });

  it("keeps a valid view, filter and cursor, and drops anything else", () => {
    expect(
      parseEnquiriesSearch(
        {
          view: "closed",
          kind: "private_sale_buy",
          department: "fine-prints",
          status: "new",
          assignee: "unassigned",
          cursor: "abc",
        },
        "open",
      ),
    ).toMatchObject({
      view: "closed",
      kind: "private_sale_buy",
      department: "fine-prints",
      status: "new",
      assignee: "unassigned",
      cursor: "abc",
    });
    expect(
      parseEnquiriesSearch(
        { view: "nope", kind: "x", status: "y", department: "Not A Slug!" },
        "open",
      ),
    ).toMatchObject({ view: "open", kind: "", status: "", department: "" });
  });

  it("reads the pages before this one, and ignores a trail that is not one", () => {
    expect(parseEnquiriesSearch({ trail: JSON.stringify(["", "c1"]) }, "open").trail).toEqual([
      "",
      "c1",
    ]);
    expect(parseEnquiriesSearch({ trail: "{bad" }, "open").trail).toEqual([]);
  });
});

describe("filters", () => {
  const none = parseEnquiriesSearch({}, "open");

  it("tell a narrowed list from a view alone", () => {
    expect(hasEnquiriesFilters(none)).toBe(false);
    expect(hasEnquiriesFilters({ ...none, status: "new" })).toBe(true);
  });

  it("go to the API with the view and only the filters that are on", () => {
    const query = enquiriesApiQuery({ ...none, view: "private_sales", department: "paintings" });
    expect(Object.fromEntries(query)).toEqual({
      view: "private_sales",
      limit: "25",
      department: "paintings",
    });
  });
});

describe("search and sort", () => {
  it("read the typed text and an arrival order, and drop any other order", () => {
    expect(parseEnquiriesSearch({ q: "  Riley ", sort: "oldest" }, "open")).toMatchObject({
      q: "Riley",
      sort: "oldest",
    });
    expect(parseEnquiriesSearch({ sort: "name" }, "open").sort).toBe("");
    expect(parseEnquiriesSearch({ q: "x".repeat(200) }, "open").q).toHaveLength(80);
  });

  it("count the search as narrowing the list, and the sort as not", () => {
    const none = parseEnquiriesSearch({}, "open");
    expect(hasEnquiriesFilters({ ...none, q: "riley" })).toBe(true);
    expect(hasEnquiriesFilters({ ...none, sort: "newest" })).toBe(false);
  });

  it("go to the API, and show as a chip that clears only the search", () => {
    const filters = parseEnquiriesSearch({ q: "riley", sort: "newest", kind: "press" }, "open");
    expect(Object.fromEntries(enquiriesApiQuery(filters))).toMatchObject({
      q: "riley",
      sort: "newest",
      kind: "press",
    });
    const chips = buildEnquiriesChips(
      filters,
      { q: "riley", sort: "newest", kind: "press" },
      "open",
      {
        q: (value) => `“${value}”`,
        kind: (value) => value,
        department: (value) => value,
        status: (value) => value,
        assignee: (value) => value,
      },
    );
    const search = chips.find((chip) => chip.id === "q");
    expect(search?.label).toBe("Search: “riley”");
    expect(search?.clearHref).toBe("/admin/enquiries?sort=newest&kind=press");
  });
});

describe("enquiriesHref", () => {
  it("leaves out the view a person lands on", () => {
    expect(enquiriesHref({}, { view: "open" }, "open")).toBe("/admin/enquiries");
    expect(enquiriesHref({}, { view: "open" }, "assigned_to_me")).toBe(
      "/admin/enquiries?view=open",
    );
  });

  it("returns to the first page when a filter changes", () => {
    expect(
      enquiriesHref(
        { view: "open", cursor: "c2", trail: '["c1"]' },
        { status: "new" },
        "assigned_to_me",
      ),
    ).toBe("/admin/enquiries?view=open&status=new");
  });

  it("links a record by its reference", () => {
    expect(enquiryHref("E-1042")).toBe("/admin/enquiries/E-1042");
  });
});

describe("buildEnquiriesChips", () => {
  it("makes one removable chip per filter, worded as the sheet reads", () => {
    const filters = parseEnquiriesSearch(
      { kind: "private_sale_sell", assignee: "unassigned" },
      "open",
    );
    const chips = buildEnquiriesChips(
      filters,
      { kind: "private_sale_sell", assignee: "unassigned" },
      "open",
      {
        kind: () => "Sell privately",
        department: (v) => v,
        status: (v) => v,
        assignee: () => "Unassigned",
      },
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "Kind: Sell privately",
      "Assignee: Unassigned",
    ]);
    expect(chips[0]?.clearHref).toBe("/admin/enquiries?assignee=unassigned");
  });
});

describe("enquiriesPagination", () => {
  const filters = parseEnquiriesSearch({}, "open");

  it("is a plain count on a single page", () => {
    expect(enquiriesPagination({}, filters, "open", { itemCount: 6, nextCursor: null })).toEqual({
      summary: "6 enquiries",
      prevHref: null,
      nextHref: null,
    });
  });

  it("is null when there is nothing to page", () => {
    expect(enquiriesPagination({}, filters, "open", { itemCount: 0, nextCursor: null })).toBeNull();
  });

  it("carries the pages before in the trail so Previous can step back", () => {
    const first = enquiriesPagination({}, filters, "open", { itemCount: 25, nextCursor: "c1" });
    expect(first?.nextHref).toBe(`/admin/enquiries?cursor=c1&trail=${encodeURIComponent('[""]')}`);
    const second = parseEnquiriesSearch({ cursor: "c1", trail: '[""]' }, "open");
    const page2 = enquiriesPagination({ cursor: "c1", trail: '[""]' }, second, "open", {
      itemCount: 4,
      nextCursor: null,
    });
    expect(page2?.summary).toBe("Page 2 · 4 enquiries");
    expect(page2?.prevHref).toBe("/admin/enquiries");
  });
});
