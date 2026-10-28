import { describe, expect, it } from "vitest";
import { buildAccountSubNav } from "./account-sub-nav.vm";
import { NO_ATTENTION } from "./client-attention";
import type { ClientNavScope } from "./client-nav-model";

const SELLER: ClientNavScope = { context: { kind: "personal" }, hasSubmissions: true };
const BUYER: ClientNavScope = { context: { kind: "personal" }, hasSubmissions: false };

function labels(scope: ClientNavScope): string[] {
  return buildAccountSubNav({ scope, pathname: "/bids", attention: null }).items.map(
    (item) => item.label,
  );
}

describe("buildAccountSubNav", () => {
  it("lists a personal account's pages, with Selling as one link", () => {
    expect(labels(SELLER)).toEqual([
      "My bids",
      "Purchases",
      "Watching",
      "Selling",
      "Notifications",
      "Bid settings",
    ]);
  });

  it("never lists LAX Account, which is another product", () => {
    const hrefs = buildAccountSubNav({ scope: SELLER, pathname: "/", attention: null }).items.map(
      (item) => item.href,
    );
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  });

  it("opens Selling at the consignments for a seller and at Sell with LAX before that", () => {
    const sellingHref = (scope: ClientNavScope) =>
      buildAccountSubNav({ scope, pathname: "/", attention: null }).items.find(
        (item) => item.id === "selling",
      )?.href;
    expect(sellingHref(SELLER)).toBe("/selling/consignments");
    expect(sellingHref(BUYER)).toBe("/selling/new");
  });

  it.each([
    ["/bids", "bids"],
    ["/bids/telephone/t1", "bids"],
    ["/purchases/checkout", "purchases"],
    ["/selling", "selling"],
    ["/selling/consignments/s1", "selling"],
    ["/selling/payouts", "selling"],
    ["/legal-entities/e1/payouts/p1/statement", "selling"],
    ["/settings/notifications", "settings"],
    ["/notifications", "notifications"],
    ["/organisations/invitations", null],
  ])("marks %s as %s", (pathname, expected) => {
    expect(buildAccountSubNav({ scope: SELLER, pathname, attention: null }).currentId).toBe(
      expected,
    );
  });

  it("shows counts only where something is due", () => {
    const vm = buildAccountSubNav({
      scope: SELLER,
      pathname: "/bids",
      attention: { ...NO_ATTENTION, outbidLots: ["14"], unreadNotifications: 3 },
    });
    const counts = Object.fromEntries(vm.items.map((item) => [item.id, item.count]));
    expect(counts.bids).toEqual({ value: 1, tone: "danger", label: "1 outbid" });
    expect(counts.notifications).toEqual({ value: 3, tone: "neutral", label: "3 unread" });
    expect(counts.purchases).toBeNull();
    expect(counts.watchlist).toBeNull();
  });
});
