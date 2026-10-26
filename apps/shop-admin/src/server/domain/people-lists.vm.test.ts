import { describe, expect, it } from "vitest";
import { auditList, clientsList, staffList, staffTeamViews } from "./people-lists.vm";
import { parseFilterValue } from "./work-list.vm";

describe("a filter rule", () => {
  it("keeps several values from a set in the set's order, and drops the rest", () => {
    const rule = { anyOf: ["a", "b", "c"] } as const;
    expect(parseFilterValue(rule, "c,x,a")).toBe("a,c");
    expect(parseFilterValue(rule, "x")).toBeUndefined();
  });

  it("takes a calendar day or a bounded free value", () => {
    expect(parseFilterValue("day", "2026-10-24")).toBe("2026-10-24");
    expect(parseFilterValue("day", "24/10/2026")).toBeUndefined();
    expect(parseFilterValue({ text: 4 }, "abcdef")).toBe("abcd");
  });
});

describe("the clients list", () => {
  it("has a view per kind that asks the API for that kind, newest first by default", () => {
    const state = clientsList.parse({ view: "gallery", q: "Ada" });
    expect(clientsList.apiQuery(state)).toEqual({ kind: "gallery", q: "Ada" });
    expect(clientsList.defaultSortState()).toEqual({ columnId: "joined", direction: "desc" });
    expect(clientsList.views(state, { person: 4, gallery: 1 }).map((view) => view.count)).toEqual([
      5, 4, 1,
    ]);
  });
});

describe("the staff list", () => {
  it("filters by one or more roles and counts views by access", () => {
    const state = staffList.parse({ view: "disabled", role: "finance,broker" });
    expect(state.filters.role).toBe("broker,finance");
    expect(staffList.apiQuery(state)).toEqual({ status: "disabled", role: "broker,finance" });
  });

  it("offers team views whose links read back as the same roles", () => {
    for (const view of staffTeamViews()) {
      const state = staffList.parse(Object.fromEntries(new URLSearchParams(view.query)));
      expect(state.filters.role).toBeTruthy();
      expect(staffList.href(state)).toBe(view.href);
    }
  });
});

describe("sorting people", () => {
  it("lists staff A to Z by default and clients newest first, with A to Z on offer", () => {
    expect(staffList.defaultSortState()).toEqual({ columnId: "name", direction: "asc" });
    expect(staffList.apiQuery(staffList.parse({}))).toEqual({});
    expect(staffList.apiQuery(staffList.parse({ sort: "added_desc" }))).toEqual({
      sort: "added_desc",
    });
    const clients = clientsList.parse({ sort: "name_asc" });
    expect(clientsList.sortState(clients)).toEqual({ columnId: "name", direction: "asc" });
    expect(clientsList.apiQuery(clients)).toEqual({ sort: "name_asc" });
  });
});

describe("the audit log", () => {
  it("holds person, action, record and dates in the URL, newest first by default", () => {
    const state = auditList.parse({
      actor: "sub-1",
      action: "mark_payout_paid",
      targetType: "shop_payout_ledger",
      from: "2026-10-01",
      to: "not-a-day",
      sort: "at_asc",
      event: "e1",
    });
    expect(state.filters).toEqual({
      actor: "sub-1",
      action: "mark_payout_paid",
      targetType: "shop_payout_ledger",
      from: "2026-10-01",
    });
    expect(state.open).toBe("e1");
    expect(auditList.apiQuery(state)).toEqual({
      actor: "sub-1",
      action: "mark_payout_paid",
      targetType: "shop_payout_ledger",
      from: "2026-10-01",
      sort: "at_asc",
    });
    expect(auditList.filtered(state)).toBe(true);
  });
});
