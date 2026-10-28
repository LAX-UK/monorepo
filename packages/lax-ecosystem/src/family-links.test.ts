import { describe, expect, it } from "vitest";
import { buildLaxFamilyLinks, buildLaxFamilyLinksFromDirectory } from "./family-links.js";

const HREFS = {
  bid: "https://lax.bid",
  art: "https://lax.art",
  shop: "https://shop.lax.art",
  account: "https://account.lax.bid/account",
};

describe("buildLaxFamilyLinks", () => {
  it("lists the products in the bar's order, then LAX Account, named as the brand writes them", () => {
    const links = buildLaxFamilyLinks({ current: "shop", hrefs: HREFS });
    expect(links.map((link) => link.label)).toEqual([
      "LAX Bid",
      "lax.art",
      "LAX Shop",
      "LAX Account",
    ]);
  });

  it("marks only the product the person is on", () => {
    const links = buildLaxFamilyLinks({ current: "art", hrefs: HREFS });
    expect(links.filter((link) => link.current).map((link) => link.id)).toEqual(["art"]);
  });

  it("marks LAX Account when the bar is on LAX Account", () => {
    const links = buildLaxFamilyLinks({ current: "account", hrefs: { ...HREFS, account: "/" } });
    expect(links.find((link) => link.current)).toMatchObject({ id: "account", href: "/" });
  });

  it("leaves out a member whose URL is not configured instead of guessing one", () => {
    const links = buildLaxFamilyLinks({
      current: "bid",
      hrefs: { bid: HREFS.bid, shop: "  ", account: undefined },
    });
    expect(links.map((link) => link.id)).toEqual(["bid"]);
  });
});

describe("buildLaxFamilyLinksFromDirectory", () => {
  it("takes the product URLs from the directory and adds the product's LAX Account link", () => {
    const links = buildLaxFamilyLinksFromDirectory(
      {
        currentProductId: "bid",
        bidPublicUrl: HREFS.bid,
        artPublicUrl: HREFS.art,
        shopStorefrontUrl: HREFS.shop,
      },
      "https://account.lax.bid/account?from=bid",
    );
    expect(links.map(({ id, href, current }) => ({ id, href, current }))).toEqual([
      { id: "bid", href: HREFS.bid, current: true },
      { id: "art", href: HREFS.art, current: false },
      { id: "shop", href: HREFS.shop, current: false },
      { id: "account", href: "https://account.lax.bid/account?from=bid", current: false },
    ]);
  });
});
