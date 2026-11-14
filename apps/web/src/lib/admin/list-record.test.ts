import { listQueryFromRecord, parseListState } from "@auction/staff-ui";
import { describe, expect, it } from "vitest";
import { listQueryOf, listRecordPager, panelParamRedirect } from "./list-record";

describe("listQueryOf", () => {
  it("keeps the list's view, search, filters, sort and page", () => {
    expect(
      listQueryOf({ view: "live", q: "rain", status: ["a", "b"], sort: "-ends", page: "3" }),
    ).toBe("view=live&q=rain&status=a&status=b&sort=-ends&page=3");
  });

  it("leaves out the panel param, notices, the KPI period and empty values", () => {
    expect(
      listQueryOf(
        { lot: "lot_1", success: "Saved", error: "x", period: "30", list: "q=a", q: "" },
        ["lot"],
      ),
    ).toBe("");
  });
});

describe("panelParamRedirect", () => {
  const href = (id: string) => `/admin/sales/${id}`;

  it("sends an old panel link to the record's page, in the same list", () => {
    const target = panelParamRedirect({ sale: "sale_1", q: "spring", sort: "-ends" }, "sale", href);
    expect(target).toBe("/admin/sales/sale_1?list=q%3Dspring%26sort%3D-ends");
    // The list it names comes back in full on the record page: a round trip.
    const listQuery = listQueryFromRecord((target ?? "").split("?")[1] ?? "");
    expect(parseListState(listQuery ?? "", { sortable: ["ends"] })).toMatchObject({
      search: "spring",
      sort: { columnId: "ends", direction: "desc" },
    });
  });

  it("opens the record on its own when the list had no state", () => {
    expect(panelParamRedirect({ sale: "sale_1" }, "sale", href)).toBe("/admin/sales/sale_1");
  });

  it("does nothing without the panel param", () => {
    expect(panelParamRedirect({ q: "spring" }, "sale", href)).toBeNull();
    expect(panelParamRedirect({ sale: " " }, "sale", href)).toBeNull();
  });
});

describe("listRecordPager", () => {
  const href = (id: string) => `/admin/lots/${id}`;

  it("places the record in the list, with its neighbours", () => {
    expect(listRecordPager(["a", "b", "c"], "b", href, "q=rain")).toEqual({
      position: 2,
      total: 3,
      previousHref: "/admin/lots/a",
      nextHref: "/admin/lots/c",
      listQuery: "q=rain",
    });
  });

  it("has no neighbour past either end", () => {
    expect(listRecordPager(["a", "b"], "a", href, "")).toMatchObject({
      position: 1,
      previousHref: null,
      nextHref: "/admin/lots/b",
    });
  });

  it("shows no pager for a record that is not in the list", () => {
    expect(listRecordPager(["a"], "z", href, "q=rain")).toBeNull();
  });
});
