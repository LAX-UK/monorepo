import { describe, expect, it } from "vitest";
import {
  type ListStateOptions,
  decodeSort,
  encodeSort,
  listQueryFromRecord,
  listStateHref,
  listStateQuery,
  parseListState,
  recordHrefInList,
  updateListState,
} from "./list-state.js";

const options: ListStateOptions = {
  filters: ["status", "sale"],
  sortable: ["ends", "created"],
  defaultSort: { columnId: "created", direction: "desc" },
  defaultView: "all",
};

describe("list state in the URL", () => {
  it("reads view, search, filters, sort and page", () => {
    expect(
      parseListState(
        "?view=mine&q=%20harbour%20&status=live&status=closed&sort=-ends&page=3",
        options,
      ),
    ).toEqual({
      view: "mine",
      search: "harbour",
      filters: { status: ["live", "closed"] },
      sort: { columnId: "ends", direction: "desc" },
      page: 3,
      cursor: null,
    });
  });

  it("falls back to the defaults for missing or unknown values", () => {
    expect(parseListState({ sort: "price", page: "0", other: "x" }, options)).toEqual({
      view: "all",
      search: null,
      filters: {},
      sort: { columnId: "created", direction: "desc" },
      page: null,
      cursor: null,
    });
  });

  it("round-trips: the URL written for a state reads back as the same state", () => {
    const state = parseListState(
      "status=closed&status=live&q=river&sort=ends&cursor=abc&view=mine",
      options,
    );
    const query = listStateQuery(state, options);
    expect(query).toBe("view=mine&q=river&status=closed&status=live&sort=ends&cursor=abc");
    expect(parseListState(query, options)).toEqual(state);
  });

  it("leaves defaults out, so one list has one address", () => {
    const state = parseListState("", options);
    expect(listStateQuery(state, options)).toBe("");
    expect(listStateHref("/admin/lots", state, options)).toBe("/admin/lots");
    expect(listStateHref("/admin/lots", { ...state, page: 2 }, options)).toBe("/admin/lots?page=2");
  });

  it("starts from the first page when the view, search, filters or sort change", () => {
    const state = parseListState("status=live&page=4", options);
    expect(updateListState(state, { search: "kite" }).page).toBeNull();
    expect(updateListState(state, { filters: { status: ["closed"] } }).page).toBeNull();
    expect(
      updateListState(state, { sort: { columnId: "ends", direction: "asc" } }).page,
    ).toBeNull();
    expect(updateListState(state, { filters: { status: ["live"] } }).page).toBe(4);
    expect(updateListState(state, { page: 5 }).page).toBe(5);
  });

  it("encodes the sort direction with a leading minus", () => {
    expect(encodeSort({ columnId: "ends", direction: "desc" })).toBe("-ends");
    expect(decodeSort("ends")).toEqual({ columnId: "ends", direction: "asc" });
    expect(decodeSort("-")).toBeNull();
  });
});

describe("a record opened from a list", () => {
  it("carries the list's query, and gives it back", () => {
    const href = recordHrefInList("/admin/lots/7", "status=live&sort=-ends");
    expect(href).toBe("/admin/lots/7?list=status%3Dlive%26sort%3D-ends");
    expect(listQueryFromRecord(new URL(href, "http://x").searchParams)).toBe(
      "status=live&sort=-ends",
    );
  });

  it("keeps the record's own params and hash, and adds nothing for an empty list query", () => {
    expect(recordHrefInList("/orders/1?tab=refunds#notes", "?q=a")).toBe(
      "/orders/1?tab=refunds&list=q%3Da#notes",
    );
    expect(recordHrefInList("/orders/1", "")).toBe("/orders/1");
    expect(listQueryFromRecord({})).toBeNull();
  });
});
