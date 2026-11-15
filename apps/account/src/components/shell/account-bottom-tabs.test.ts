import { buildAccountNav } from "@/server/domain/account-nav.vm";
import { describe, expect, it } from "vitest";
import { buildAccountBottomTabs } from "./account-bottom-tabs";

const support = {
  helpCentre: "https://lax.bid/faq",
  contact: "https://lax.bid/contact",
  terms: "https://lax.bid/terms",
  privacyPolicy: "https://lax.bid/privacy",
};
const items = buildAccountNav({ support }, { selling: true });
const current = (path: string) =>
  buildAccountBottomTabs(items, path)
    .filter((tab) => tab.paths.length > 0)
    .map((tab) => tab.key);

describe("buildAccountBottomTabs", () => {
  it("is Home, Portfolio, Money, then More, linking to the menu's own hrefs", () => {
    const tabs = buildAccountBottomTabs(items, "/account");
    expect(tabs.map((tab) => tab.label)).toEqual(["Home", "Portfolio", "Money", "More"]);
    expect(tabs.map((tab) => tab.href)).toEqual([
      "/account",
      items.find((i) => i.id === "portfolio")?.href,
      items.find((i) => i.id === "money")?.href,
      undefined,
    ]);
  });

  it("marks one tab current per route", () => {
    expect(current("/account")).toEqual(["home"]);
    expect(current("/account/portfolio")).toEqual(["portfolio"]);
    expect(current("/account/portfolio/money")).toEqual(["money"]);
  });

  it("marks More for menu pages without a tab, and nothing outside the menu", () => {
    expect(current("/account/security")).toEqual(["more"]);
    expect(current("/account/help")).toEqual(["more"]);
    expect(current("/elsewhere")).toEqual([]);
  });
});
