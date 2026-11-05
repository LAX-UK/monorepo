import { describe, expect, it } from "vitest";
import { badgeCountText, isTabCurrent } from "./bottom-tab-config.js";

const BID_TABS = {
  home: { paths: ["/"] },
  auctions: { paths: ["/sales"] },
  watching: { paths: ["/watching"] },
  account: { paths: ["/account"] },
};

describe("isTabCurrent", () => {
  it("matches Home on the home page only", () => {
    expect(isTabCurrent(BID_TABS.home, "/")).toBe(true);
    expect(isTabCurrent(BID_TABS.home, "/sales")).toBe(false);
  });

  it("matches a tab on its path and anything beneath it", () => {
    expect(isTabCurrent(BID_TABS.auctions, "/sales")).toBe(true);
    expect(isTabCurrent(BID_TABS.auctions, "/sales/spring-2026/lots/4")).toBe(true);
    expect(isTabCurrent(BID_TABS.auctions, "/sales/")).toBe(true);
  });

  it("does not match a path that only shares a prefix", () => {
    expect(isTabCurrent(BID_TABS.auctions, "/sales-archive")).toBe(false);
    expect(isTabCurrent(BID_TABS.watching, "/watch")).toBe(false);
  });

  it("ignores the query string and hash", () => {
    expect(isTabCurrent(BID_TABS.watching, "/watching?filter=outbid#top")).toBe(true);
  });

  it("accepts several paths per tab", () => {
    const shop = { paths: ["/artworks", "/editions"] };
    expect(isTabCurrent(shop, "/editions/xyz")).toBe(true);
    expect(isTabCurrent(shop, "/basket")).toBe(false);
  });
});

describe("badgeCountText", () => {
  it("shows the count up to nine and 9+ above", () => {
    expect(badgeCountText(1)).toBe("1");
    expect(badgeCountText(9)).toBe("9");
    expect(badgeCountText(10)).toBe("9+");
    expect(badgeCountText(250)).toBe("9+");
  });

  it("shows nothing for zero or invalid counts", () => {
    expect(badgeCountText(0)).toBeNull();
    expect(badgeCountText(-2)).toBeNull();
    expect(badgeCountText(Number.NaN)).toBeNull();
  });
});
