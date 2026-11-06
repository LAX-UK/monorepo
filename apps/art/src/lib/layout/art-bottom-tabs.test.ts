import type { MarketingBottomTab } from "@auction/marketing-ui";
import { isTabCurrent } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import { buildArtBottomTabs } from "./art-bottom-tabs.js";

const ICONS = {
  home: "home",
  artworks: "artworks",
  search: "search",
  favourites: "favourites",
  account: "account",
};

function tabs(pathname: string, options: { signedOut?: boolean; replyDot?: boolean } = {}) {
  return buildArtBottomTabs({
    pathname,
    signedOut: options.signedOut ?? false,
    replyDot: options.replyDot ?? false,
    icons: ICONS,
  });
}

/** Keys of the tabs the shared bar would mark current: links only, as the bar does. */
function currentKeys(pathname: string, options: { signedOut?: boolean } = {}): string[] {
  return tabs(pathname, options)
    .filter((tab: MarketingBottomTab) => tab.href !== undefined && isTabCurrent(tab, pathname))
    .map((tab) => tab.key);
}

describe("lax.art bottom tabs", () => {
  it("has the five tabs in order", () => {
    expect(tabs("/").map((tab) => [tab.key, tab.label])).toEqual([
      ["home", "Home"],
      ["artworks", "Artworks"],
      ["search", "Search"],
      ["favourites", "Favourites"],
      ["account", "Account"],
    ]);
  });

  it("links Home, Artworks, Favourites and Account, and makes Search an action", () => {
    const byKey = Object.fromEntries(tabs("/").map((tab) => [tab.key, tab]));
    expect(byKey.home?.href).toBe("/");
    expect(byKey.artworks?.href).toBe("/artworks");
    expect(byKey.favourites?.href).toBe("/account/favourites");
    expect(byKey.account?.href).toBe("/account");
    expect(byKey.search?.action).toBe("search");
    expect(byKey.search?.href).toBeUndefined();
  });

  it.each([
    ["/", ["home"]],
    ["/artworks", ["artworks"]],
    ["/artworks/warm-basket", ["artworks"]],
    ["/paintings", ["artworks"]],
    ["/sculptures", ["artworks"]],
    ["/sculptures/bronze-study", ["artworks"]],
    ["/account", ["account"]],
    ["/account/enquiries", ["account"]],
    ["/account/favourites", ["favourites"]],
    ["/search", []],
    ["/artists/flora-powers", []],
    ["/exhibitions", []],
  ])("marks %s current for %j", (pathname, expected) => {
    expect(currentKeys(pathname)).toEqual(expected);
  });

  it("does not match paths that only share a prefix", () => {
    expect(currentKeys("/artworks-archive")).toEqual([]);
    expect(currentKeys("/paintings-and-more")).toEqual([]);
  });

  it("never marks Search current, on its results page or anywhere", () => {
    expect(currentKeys("/search")).not.toContain("search");
    expect(tabs("/search").find((tab) => tab.key === "search")?.paths).toEqual([]);
  });

  describe("signed out", () => {
    it("sends Favourites and Account to Sign in, returning to the tab's own page", () => {
      const byKey = Object.fromEntries(tabs("/", { signedOut: true }).map((tab) => [tab.key, tab]));
      expect(byKey.favourites?.href).toBe("/login?returnTo=%2Faccount%2Ffavourites");
      expect(byKey.account?.href).toBe("/login?returnTo=%2Faccount");
    });

    it("uses a full-page link for sign-in so the login start is never prefetched", () => {
      const byKey = Object.fromEntries(tabs("/", { signedOut: true }).map((tab) => [tab.key, tab]));
      expect(byKey.favourites?.fullPageNavigation).toBe(true);
      expect(byKey.account?.fullPageNavigation).toBe(true);
      expect(byKey.home?.fullPageNavigation).toBeUndefined();
      expect(byKey.artworks?.fullPageNavigation).toBeUndefined();
    });

    it("leaves signed-in links as ordinary client navigation", () => {
      for (const tab of tabs("/")) expect(tab.fullPageNavigation).toBeUndefined();
    });
  });

  describe("reply dot", () => {
    const account = (list: MarketingBottomTab[]) => list.find((tab) => tab.key === "account");

    it("shows a dot on Account when a reply is waiting", () => {
      expect(account(tabs("/", { replyDot: true }))?.badge).toEqual({ kind: "dot" });
    });

    it("shows none otherwise", () => {
      expect(account(tabs("/"))?.badge).toBeNull();
    });

    it("hides the dot while the person is reading their enquiries", () => {
      expect(account(tabs("/account/enquiries", { replyDot: true }))?.badge).toBeNull();
    });

    it("never shows the dot to a signed-out visitor", () => {
      expect(account(tabs("/", { replyDot: true, signedOut: true }))?.badge).toBeNull();
    });
  });
});
