import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { describe, expect, it } from "vitest";
import type { AccountOption } from "./account-switcher-model";
import { NO_ATTENTION } from "./client-attention";
import type { ClientNavScope } from "./client-nav-model";
import { buildHeaderAccountMenu } from "./header-account-menu.vm";

const PERSONAL: ClientNavScope = { context: { kind: "personal" }, hasSubmissions: true };

const ACCOUNTS: AccountOption[] = [
  {
    id: "me",
    kind: "personal",
    name: "Personal",
    detail: "Jordan Hale",
    initials: "JH",
    current: true,
    underReview: false,
  },
  {
    id: "org-1",
    kind: "organisation",
    name: "Northgate Collection Ltd",
    detail: "Buyer",
    initials: "NC",
    current: false,
    underReview: false,
  },
];

function menu(overrides: Partial<Parameters<typeof buildHeaderAccountMenu>[0]> = {}) {
  return buildHeaderAccountMenu({
    scope: PERSONAL,
    accounts: null,
    pendingInvitations: 0,
    attention: NO_ATTENTION,
    pathname: "/bids",
    ...overrides,
  });
}

describe("buildHeaderAccountMenu", () => {
  it("groups a personal account's pages as Buying, Selling, then account pages", () => {
    expect(menu().sections.map((s) => [s.label, s.links.map((l) => l.label)])).toEqual([
      ["Buying", ["My bids", "Purchases", "Watching"]],
      ["Selling", ["Consignments", "Sold & payouts"]],
      [null, ["Notifications", "Bid settings", "LAX Account"]],
    ]);
  });

  it("offers Sell a work before a first submission", () => {
    const selling = menu({ scope: { ...PERSONAL, hasSubmissions: false } }).sections.find(
      (s) => s.id === "selling",
    );
    expect(selling?.links.map((l) => [l.label, l.href])).toEqual([["Sell a work", "/selling/new"]]);
  });

  it("marks the page in view and links LAX Account out of Bid", () => {
    const links = menu({ pathname: "/purchases/checkout" }).sections.flatMap((s) => s.links);
    expect(links.filter((l) => l.current).map((l) => l.id)).toEqual(["purchases"]);
    expect(links.find((l) => l.id === "lax-account")).toMatchObject({
      href: laxAccountHomeUrl(),
      external: true,
      current: false,
    });
  });

  it("hides Your accounts from people with only their own account", () => {
    expect(menu({ accounts: [ACCOUNTS[0] as AccountOption] }).accounts).toBeNull();
    expect(menu().accounts).toBeNull();
  });

  it("shows the account in use as here and opens an organisation in its workspace", () => {
    expect(menu({ accounts: ACCOUNTS }).accounts).toEqual([
      {
        id: "me",
        kind: "personal",
        name: "Personal",
        detail: "Bids, purchases and selling",
        initials: "JH",
        here: true,
        href: "/bids",
      },
      {
        id: "org-1",
        kind: "organisation",
        name: "Northgate Collection Ltd",
        detail: "Organisation workspace · Buyer",
        initials: "NC",
        here: false,
        href: "/switch-account?to=org-1&next=%2Fhome",
      },
    ]);
  });

  it("opens the personal pages at My bids from an organisation", () => {
    const fromOrg = ACCOUNTS.map((option) => ({ ...option, current: option.kind !== "personal" }));
    expect(menu({ accounts: fromOrg }).accounts?.[0]).toMatchObject({
      here: false,
      href: "/switch-account?to=me&next=%2Fbids",
    });
  });

  it("carries what is due to the matching pages", () => {
    const links = menu({
      attention: { outbidLots: ["14"], paymentsDue: 1, unreadNotifications: 3, groups: [] },
    }).sections.flatMap((s) => s.links);
    const counts = Object.fromEntries(links.map((l) => [l.id, l.count?.label ?? null]));
    expect(counts).toMatchObject({
      bids: "1 outbid",
      purchases: "1 to pay",
      watchlist: null,
      notifications: "3 unread",
    });
  });

  it("offers pending invitations when there are some", () => {
    expect(menu().invitations).toBeNull();
    expect(menu({ pendingInvitations: 2 }).invitations).toMatchObject({
      label: "Pending invitations (2)",
      href: "/organisations/invitations",
    });
  });
});
