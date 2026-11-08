import { describe, expect, it } from "vitest";
import {
  findSearchAlert,
  hasSearchAlert,
  pastResultsSentence,
  searchAlertQuery,
  searchAlertState,
  shouldOfferPastResults,
} from "./search-fallback";

const base = {
  q: "harbour",
  status: undefined,
  ending: undefined,
  offset: 0,
  onSaleCount: 0,
  loadFailed: false,
} as const;

describe("shouldOfferPastResults", () => {
  it("offers past results for a text search with nothing on sale", () => {
    expect(shouldOfferPastResults(base)).toBe(true);
  });
  it.each([
    ["no text", { q: "" }],
    ["a chosen status", { status: "ended" as const }],
    ["an ending window", { ending: "24h" }],
    ["a later page", { offset: 24 }],
    ["lots on sale", { onSaleCount: 2 }],
    ["a failed load", { loadFailed: true }],
  ])("does not offer them with %s", (_name, patch) => {
    expect(shouldOfferPastResults({ ...base, ...patch })).toBe(false);
  });
});

describe("pastResultsSentence", () => {
  it("says nothing for none", () => expect(pastResultsSentence(0)).toBe(""));
  it("is singular for one", () => expect(pastResultsSentence(1)).toBe("One past result matches."));
  it("spells small counts", () => expect(pastResultsSentence(3)).toBe("Three past results match."));
  it("uses digits from ten", () => expect(pastResultsSentence(12)).toBe("12 past results match."));
});

describe("searchAlertQuery", () => {
  it("keeps the text and the category only", () => {
    expect(searchAlertQuery("harbour")).toEqual({ q: "harbour" });
    expect(searchAlertQuery("harbour", "c1")).toEqual({ q: "harbour", categoryId: "c1" });
  });
});

describe("hasSearchAlert", () => {
  const saved = [{ query: { q: "harbour" } }, { query: { q: "oil", categoryId: "c1" } }];

  it("finds an alert for the same text and category", () => {
    expect(hasSearchAlert(saved, "harbour")).toBe(true);
    expect(hasSearchAlert(saved, "oil", "c1")).toBe(true);
  });

  it("does not match a different text or category", () => {
    expect(hasSearchAlert(saved, "harbours")).toBe(false);
    expect(hasSearchAlert(saved, "oil")).toBe(false);
    expect(hasSearchAlert(saved, "harbour", "c1")).toBe(false);
    expect(hasSearchAlert([], "harbour")).toBe(false);
  });
});

describe("searchAlertState", () => {
  const saved = [
    { query: { q: "harbour" }, notifyEmail: true },
    { query: { q: "oil", categoryId: "c1" }, notifyEmail: false },
  ];

  it("reads on, email off and none from the saved searches", () => {
    expect(searchAlertState(saved, "harbour")).toBe("on");
    expect(searchAlertState(saved, "oil", "c1")).toBe("email_off");
    expect(searchAlertState(saved, "oil")).toBe("none");
    expect(searchAlertState([], "harbour")).toBe("none");
  });

  it("says email off when the topic's email is off, and trusts the search when it is unknown", () => {
    expect(searchAlertState(saved, "harbour", undefined, false)).toBe("email_off");
    expect(searchAlertState(saved, "harbour", undefined, true)).toBe("on");
    expect(searchAlertState(saved, "harbour", undefined, null)).toBe("on");
  });
});

describe("findSearchAlert", () => {
  it("finds the saved search holding this search", () => {
    const saved = [
      { id: "a", query: { q: "harbour" } },
      { id: "b", query: { q: "oil" } },
    ];
    expect(findSearchAlert(saved, "oil")?.id).toBe("b");
    expect(findSearchAlert(saved, "tide")).toBeUndefined();
  });
});
