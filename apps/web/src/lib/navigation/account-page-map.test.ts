import { describe, expect, it } from "vitest";
import { existsInBothAccounts, pageAfterSwitch } from "./account-page-map";

describe("pageAfterSwitch", () => {
  it.each(["/bids", "/purchases", "/watching", "/notifications", "/settings", "/selling"])(
    "stays on %s in either direction",
    (path) => {
      expect(pageAfterSwitch(path, "organisation")).toBe(path);
      expect(pageAfterSwitch(path, "personal")).toBe(path);
    },
  );

  it("drops the query, which names things of the account just left", () => {
    expect(pageAfterSwitch("/bids?tab=won&q=vase", "organisation")).toBe("/bids");
    expect(pageAfterSwitch("/watching?tab=searches", "personal")).toBe("/watching");
  });

  it("ignores a trailing slash", () => {
    expect(pageAfterSwitch("/purchases/", "organisation")).toBe("/purchases");
  });

  it("opens the organisation's Home from a page only the other account has", () => {
    expect(pageAfterSwitch("/selling/new", "organisation")).toBe("/home");
  });

  it("opens My bids from a page only an organisation has", () => {
    expect(pageAfterSwitch("/team", "personal")).toBe("/bids");
    expect(pageAfterSwitch("/organisation/documents", "personal")).toBe("/bids");
    expect(pageAfterSwitch("/home", "personal")).toBe("/bids");
  });

  it("opens the account's first page from a record of the account just left", () => {
    expect(pageAfterSwitch("/purchases/abc-123", "organisation")).toBe("/home");
  });

  it("opens the account's first page when the current page is unknown", () => {
    expect(pageAfterSwitch(null, "organisation")).toBe("/home");
    expect(pageAfterSwitch(null, "personal")).toBe("/bids");
  });
});

describe("public pages", () => {
  it("stay where they are, query included, whichever account is chosen", () => {
    expect(pageAfterSwitch("/lot/vase/abc-123", "organisation")).toBe("/lot/vase/abc-123");
    expect(pageAfterSwitch("/sales/spring?tab=lots", "personal")).toBe("/sales/spring?tab=lots");
    expect(pageAfterSwitch("/artists", "organisation")).toBe("/artists");
  });

  it("do not include the hops, which are client-area pages", () => {
    expect(pageAfterSwitch("/switch-account", "organisation")).toBe("/home");
  });
});

describe("existsInBothAccounts", () => {
  it("is false for pages of one kind of account", () => {
    expect(existsInBothAccounts("/home")).toBe(false);
    expect(existsInBothAccounts("/team")).toBe(false);
  });
});
