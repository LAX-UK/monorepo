import { describe, expect, it } from "vitest";
import { type FilterFieldVm, activeFilterChips, filterHref, singularOf } from "./filter-query";

const fields: FilterFieldVm[] = [
  {
    name: "status",
    label: "Status",
    value: "owned",
    options: [{ value: "owned", label: "Owned" }],
  },
  { name: "currency", label: "Currency", value: "", options: [{ value: "GBP", label: "GBP" }] },
];
const search = { name: "q", value: "blue", label: "Search", placeholder: "Search" };

describe("filterHref", () => {
  it("keeps every other filter and the search when one changes", () => {
    expect(
      filterHref("/p", fields, search, { kind: "field", name: "currency", value: "GBP" }),
    ).toBe("/p?status=owned&currency=GBP&q=blue");
  });

  it("removes a filter by setting it to empty", () => {
    expect(filterHref("/p", fields, search, { kind: "field", name: "status", value: "" })).toBe(
      "/p?q=blue",
    );
  });

  it("changes the search text, trimmed, and drops it when blank", () => {
    expect(filterHref("/p", fields, search, { kind: "search", value: " red " })).toBe(
      "/p?status=owned&q=red",
    );
    expect(filterHref("/p", fields, search, { kind: "search", value: "  " })).toBe(
      "/p?status=owned",
    );
  });

  it("clears everything, leaving the bare path", () => {
    expect(filterHref("/p", fields, search, { kind: "clear" })).toBe("/p");
  });

  it("works without a search box", () => {
    expect(filterHref("/p", fields, undefined)).toBe("/p?status=owned");
  });
});

describe("activeFilterChips", () => {
  it("lists only set filters, using the option's label", () => {
    expect(activeFilterChips(fields)).toEqual([{ name: "status", text: "Owned", group: "Status" }]);
  });
});

describe("singularOf", () => {
  it("names one result", () => {
    expect(singularOf("works")).toBe("work");
    expect(singularOf("entries")).toBe("entry");
    expect(singularOf("money entries")).toBe("money entry");
  });
});
