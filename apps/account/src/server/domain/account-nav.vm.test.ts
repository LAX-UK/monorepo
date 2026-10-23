import { describe, expect, it } from "vitest";
import { activeAccountNavId, buildAccountNav, buildProductBar } from "./account-nav.vm";

const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};

describe("buildAccountNav", () => {
  it("lists the seven destinations in order, with the routes that exist", () => {
    const items = buildAccountNav({ support });
    expect(items.map((item) => item.label)).toEqual([
      "Home",
      "Personal details",
      "Security",
      "Portfolio",
      "Money",
      "Privacy",
      "Help",
    ]);
    expect(items.map((item) => item.href)).toEqual([
      "/account",
      "/account/profile",
      "/account/security",
      "/account/portfolio",
      "/account/portfolio/money",
      "/account/privacy",
      "/account/help",
    ]);
  });

  it("leaves Help out without Bid's support pages", () => {
    expect(buildAccountNav({ support: null }).map((item) => item.id)).not.toContain("help");
  });
});

describe("buildProductBar", () => {
  it("lists Bid, Art and Shop, then Account as the current product", () => {
    const bar = buildProductBar({
      bidPublicUrl: "https://lax.bid",
      laxArtPublicUrl: "https://lax.art",
      shopPublicUrl: "https://shop.lax.bid",
    });
    expect(bar.map((item) => item.label)).toEqual([
      "LAX Bid",
      "LAX Art",
      "LAX Shop",
      "LAX Account",
    ]);
    expect(bar.filter((item) => item.current).map((item) => item.id)).toEqual(["account"]);
  });

  it("skips a product without a URL", () => {
    const bar = buildProductBar({ bidPublicUrl: "https://lax.bid" });
    expect(bar.map((item) => item.id)).toEqual(["bid", "account"]);
  });
});

describe("activeAccountNavId", () => {
  const items = buildAccountNav({ support });

  it("matches Home only on its own path", () => {
    expect(activeAccountNavId("/account", items)).toBe("home");
    expect(activeAccountNavId("/account/", items)).toBe("home");
    expect(activeAccountNavId("/account/email-change", items)).toBeNull();
  });

  it("matches the deepest entry, so Money does not light up Portfolio", () => {
    expect(activeAccountNavId("/account/portfolio", items)).toBe("portfolio");
    expect(activeAccountNavId("/account/portfolio/money", items)).toBe("money");
    expect(activeAccountNavId("/account/portfolio/bid/lot-1", items)).toBe("portfolio");
  });

  it("keeps a sub-page under its section", () => {
    expect(activeAccountNavId("/account/security/delete", items)).toBe("security");
    expect(activeAccountNavId("/account/profile", items)).toBe("personal-details");
  });

  it("matches nothing for the signed-out pages", () => {
    expect(activeAccountNavId("/", items)).toBeNull();
  });
});
