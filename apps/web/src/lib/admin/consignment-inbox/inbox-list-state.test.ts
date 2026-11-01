import { describe, expect, it } from "vitest";
import {
  inboxApiQuery,
  inboxFilterChips,
  inboxFiltered,
  inboxHref,
  inboxRangeSummary,
  inboxSort,
  inboxThreadHref,
  inboxViews,
  parseInboxListState,
} from "./inbox-list-state";

describe("parseInboxListState", () => {
  it("defaults to the unanswered view at the first page", () => {
    const state = parseInboxListState({});
    expect(state).toMatchObject({
      view: "unanswered",
      q: "",
      specialist: [],
      sort: null,
      offset: 0,
    });
    expect(inboxSort(state)).toBe("waiting");
  });

  it("reads lists, ignores unknown views and sorts, and drops duplicates", () => {
    const state = parseInboxListState({
      view: "nope",
      sort: "random",
      specialist: "u1,u1,unassigned",
      sale: ["s1"],
      offset: "-5",
    });
    expect(state.view).toBe("unanswered");
    expect(state.sort).toBeNull();
    expect(state.specialist).toEqual(["u1", "unassigned"]);
    expect(state.sale).toEqual(["s1"]);
    expect(state.offset).toBe(0);
  });

  it("sorts the record views by latest activity by default", () => {
    expect(inboxSort(parseInboxListState({ view: "closed" }))).toBe("latest");
  });
});

describe("inboxHref", () => {
  const state = parseInboxListState({ view: "unanswered", q: "harbour", offset: "50" });

  it("keeps defaults out of the URL and starts a changed list at the first page", () => {
    expect(inboxHref(state, { sale: ["s1"] })).toBe("/admin/inbox?q=harbour&sale=s1");
  });

  it("keeps the page only when paging", () => {
    expect(inboxHref(state, { offset: 100 })).toBe("/admin/inbox?q=harbour&offset=100");
  });

  it("drops a sort that was only the old view's default when the view changes", () => {
    const sorted = parseInboxListState({ view: "all", sort: "oldest" });
    expect(inboxHref(sorted, { view: "closed" })).toBe("/admin/inbox?view=closed");
  });
});

describe("inboxApiQuery", () => {
  it("always names the view and the page size for the API", () => {
    const params = inboxApiQuery(parseInboxListState({}));
    expect(params.get("view")).toBe("unanswered");
    expect(params.get("limit")).toBe("50");
  });
});

describe("inboxThreadHref", () => {
  it("carries the list so the thread page can page through it", () => {
    const state = parseInboxListState({ specialist: "u1" });
    expect(inboxThreadHref("abc", state)).toBe("/admin/inbox/abc?specialist=u1&view=unanswered");
    expect(inboxThreadHref("abc", null)).toBe("/admin/inbox/abc");
  });
});

describe("inboxViews", () => {
  it("puts counts on the two views that need action, never a zero", () => {
    const views = inboxViews(parseInboxListState({}), {
      unanswered: 12,
      mine: { waiting: 0, overdue: 0, oldestWaitingSince: null },
      unassigned: { waiting: 1, oldestWaitingSince: null, oldestAccountName: null },
    });
    expect(views.map((v) => [v.label, "count" in v ? v.count : undefined])).toEqual([
      ["Unanswered", 12],
      ["Assigned to me", undefined],
      ["All", undefined],
      ["Closed", undefined],
    ]);
  });
});

describe("inboxFilterChips", () => {
  it("names each filter by its label and links to the list without it", () => {
    const state = parseInboxListState({ q: "harbour", sale: "s1", specialist: "u2" });
    const chips = inboxFilterChips(state, {
      specialist: [{ id: "u2", label: "James Hale", count: 1 }],
      sale: [{ id: "s1", label: "Modern British & Irish Art", count: 3 }],
      organisation: [],
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      "Search: “harbour”",
      "Specialist: James Hale",
      "Sale: Modern British & Irish Art",
    ]);
    expect(chips[2]?.href).toBe("/admin/inbox?q=harbour&specialist=u2");
    expect(inboxFiltered(state)).toBe(true);
  });
});

describe("inboxRangeSummary", () => {
  it("reads 1–6 of 12", () => {
    expect(inboxRangeSummary(0, 6, 12)).toBe("1–6 of 12");
    expect(inboxRangeSummary(0, 0, 0)).toBe("0 threads");
  });
});
