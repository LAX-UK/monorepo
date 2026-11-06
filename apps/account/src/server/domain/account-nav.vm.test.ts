import { describe, expect, it } from "vitest";
import {
  activeAccountNavId,
  buildAccountNav,
  buildProductBar,
  groupAccountNav,
} from "./account-nav.vm";

const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};

describe("buildAccountNav", () => {
  it("lists the eight destinations in order, with the routes that exist", () => {
    const items = buildAccountNav({ support });
    expect(items.map((item) => item.label)).toEqual([
      "Home",
      "Portfolio",
      "Money",
      "Personal details",
      "Security",
      "Email alerts",
      "Privacy",
      "Help",
    ]);
    expect(items.map((item) => item.href)).toEqual([
      "/account",
      "/account/portfolio",
      "/account/portfolio/money",
      "/account/profile",
      "/account/security",
      "/account/alerts",
      "/account/privacy",
      "/account/help",
    ]);
  });

  it("adds Selling after Money, in Your collection, only for people who sell", () => {
    expect(buildAccountNav({ support }).map((item) => item.id)).not.toContain("selling");
    const items = buildAccountNav({ support }, { selling: true });
    expect(items.map((item) => item.id)).toEqual([
      "home",
      "portfolio",
      "money",
      "selling",
      "personal-details",
      "security",
      "alerts",
      "privacy",
      "help",
    ]);
    expect(items.find((item) => item.id === "selling")?.href).toBe("/account/selling");
    expect(activeAccountNavId("/account/selling/payouts", items)).toBe("selling");
  });

  it("puts Home first, then Your collection, then Your account, then Help last", () => {
    const sections = groupAccountNav(buildAccountNav({ support }, { selling: true }));
    expect(sections.map((section) => [section.label, section.items.map((i) => i.label)])).toEqual([
      [null, ["Home"]],
      ["Your collection", ["Portfolio", "Money", "Selling"]],
      ["Your account", ["Personal details", "Security", "Email alerts", "Privacy"]],
      [null, ["Help"]],
    ]);
  });

  it("drops Selling from its group for people who do not sell, and Help without support", () => {
    const sections = groupAccountNav(buildAccountNav({ support: null }));
    expect(sections.map((section) => section.label)).toEqual([
      null,
      "Your collection",
      "Your account",
    ]);
    expect(sections[1]?.items.map((i) => i.label)).toEqual(["Portfolio", "Money"]);
  });

  it("leaves Help out without Bid's support pages", () => {
    expect(buildAccountNav({ support: null }).map((item) => item.id)).not.toContain("help");
  });
});

describe("buildProductBar", () => {
  it("lists lax.art, lax.shop and lax.bid, then Account as the current member", () => {
    const bar = buildProductBar({
      bidPublicUrl: "https://lax.bid",
      laxArtPublicUrl: "https://lax.art",
      shopPublicUrl: "https://shop.lax.bid",
    });
    expect(bar.map((item) => item.label)).toEqual([
      "lax.art",
      "lax.shop",
      "lax.bid",
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
