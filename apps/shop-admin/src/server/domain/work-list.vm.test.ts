import { describe, expect, it } from "vitest";
import { fulfilmentList, payoutsList, productionList, saleRequestsList } from "./sales-lists.vm";
import { pageSummary } from "./work-list.vm";

describe("a work list's URL", () => {
  it("reads the view, search, filters, sort, page size and the open record", () => {
    const state = payoutsList.parse({
      view: "due",
      q: " Ada ",
      source: "original_sale",
      sort: "due_asc",
      limit: "100",
      cursor: "c1",
      payout: "p1",
    });
    expect(state).toEqual({
      view: "due",
      q: "Ada",
      sort: "due_asc",
      cursor: "c1",
      limit: "100",
      filters: { source: "original_sale" },
      open: "p1",
    });
  });

  it("drops anything it does not know, so a hand-edited link still opens the list", () => {
    expect(
      payoutsList.parse({ view: "later", source: "bank", sort: "amount_desc", limit: "7" }),
    ).toEqual({ view: "all", filters: {} });
  });

  it("starts each list on its own default view", () => {
    expect(fulfilmentList.parse({}).view).toBe("open");
    expect(saleRequestsList.parse({}).view).toBe("pending");
    expect(productionList.parse({}).view).toBe("all");
  });

  it("returns to the first page and closes the panel when the query changes", () => {
    const state = payoutsList.parse({ view: "due", cursor: "c1", payout: "p1" });
    expect(payoutsList.href(state, { q: "Theo" })).toBe("/payouts?view=due&q=Theo");
    expect(payoutsList.href(state, { view: "all" })).toBe("/payouts");
  });

  it("keeps the query on the next page and on the panel link", () => {
    const state = payoutsList.parse({ view: "due", q: "Theo" });
    expect(payoutsList.pageHref(state, "c2")).toBe("/payouts?view=due&q=Theo&cursor=c2");
    expect(payoutsList.panelHref(state, "p9")).toBe("/payouts?view=due&q=Theo&payout=p9");
    expect(payoutsList.panelHref({ ...state, open: "p9" }, null)).toBe("/payouts?view=due&q=Theo");
  });

  it("asks the API for the view's statuses, the search, the filters and the sort", () => {
    const state = fulfilmentList.parse({ q: "AB12", option: "lax_storage", sort: "updated_asc" });
    expect(fulfilmentList.apiQuery(state)).toEqual({
      stage: "open",
      q: "AB12",
      option: "lax_storage",
      sort: "updated_asc",
    });
    expect(saleRequestsList.apiQuery(saleRequestsList.parse({ view: "all" }))).toEqual({});
  });
});

describe("a work list's sort", () => {
  it("always shows a sort, the default when the URL has none", () => {
    expect(payoutsList.sortState(payoutsList.parse({}))).toEqual({
      columnId: "due",
      direction: "desc",
    });
    expect(payoutsList.sortState(payoutsList.parse({ sort: "created_asc" }))).toEqual({
      columnId: "created",
      direction: "asc",
    });
  });

  it("keeps the default out of the URL", () => {
    expect(payoutsList.sortParam({ columnId: "due", direction: "desc" })).toBeNull();
    expect(payoutsList.sortParam({ columnId: "due", direction: "asc" })).toBe("due_asc");
    expect(payoutsList.sortParam({ columnId: "payee", direction: "asc" })).toBeNull();
  });
});

describe("a work list's views", () => {
  it("counts each view from the per-status counts, groups included", () => {
    const state = fulfilmentList.parse({});
    const views = fulfilmentList.views(state, {
      pending_production: 2,
      awaiting_dispatch: 3,
      in_transit: 1,
      delivered: 7,
      cancelled: 1,
    });
    const count = (id: string) => views.find((view) => view.id === id)?.count;
    expect(count("open")).toBe(6);
    expect(count("awaiting_dispatch")).toBe(3);
    expect(count("done")).toBe(8);
    expect(count("all")).toBe(14);
    expect(views.find((view) => view.id === "done")?.href).toBe("/fulfilment?view=done");
  });

  it("shows no number on a view when the counts are missing, rather than a false zero", () => {
    const views = payoutsList.views(payoutsList.parse({}), undefined);
    expect(views.every((view) => view.count === undefined)).toBe(true);
  });

  it("labels views in words", () => {
    const labels = saleRequestsList.views(saleRequestsList.parse({}), {}).map((view) => view.label);
    expect(labels).toEqual(["Waiting for review", "Approved", "Declined", "Withdrawn", "All"]);
  });

  it("counts a search or filter as narrowing, but not the view or the page", () => {
    expect(payoutsList.filtered(payoutsList.parse({ view: "due", cursor: "c" }))).toBe(false);
    expect(payoutsList.filtered(payoutsList.parse({ q: "Ada" }))).toBe(true);
    expect(payoutsList.filtered(payoutsList.parse({ source: "order_line" }))).toBe(true);
  });
});

describe("pageSummary", () => {
  it("says how many rows the page holds", () => {
    expect(pageSummary(1, { one: "payout", other: "payouts" })).toBe("1 payout on this page");
    expect(pageSummary(50, { one: "payout", other: "payouts" })).toBe("50 payouts on this page");
  });
});
