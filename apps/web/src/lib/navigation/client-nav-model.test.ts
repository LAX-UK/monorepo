import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { entityRoleCan } from "@auction/domain";
import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type AccountContext,
  type ClientNavScope,
  getClientMobileTabs,
  getClientNavItems,
  getClientNavSections,
} from "./client-nav-model";

function org(role: LegalEntityMemberRole): AccountContext {
  return { kind: "organisation", id: "org-1", role };
}

function scope(context: AccountContext, hasSubmissions = false): ClientNavScope {
  return { context, hasSubmissions };
}

/** The menu as `section: item ids`, the shape a reader scans. */
function menu(navScope: ClientNavScope): Record<string, string[]> {
  return Object.fromEntries(
    getClientNavSections(navScope).map((section) => [
      section.id,
      section.items.map((item) => item.id),
    ]),
  );
}

const ACCOUNT = ["notifications", "settings", "lax-account"];

describe("menu sections, personal account", () => {
  it("before any submission, Selling is a single Sell with LAX link", () => {
    expect(menu(scope({ kind: "personal" }))).toEqual({
      buying: ["bids", "purchases", "watchlist"],
      selling: ["sell"],
      account: ACCOUNT,
    });
  });

  it("after a first submission, Selling lists Consignments and Sold & payouts", () => {
    expect(menu(scope({ kind: "personal" }, true))).toEqual({
      buying: ["bids", "purchases", "watchlist"],
      selling: ["consignments", "payouts"],
      account: ACCOUNT,
    });
  });

  it("labels the sections and the personal pages as the person sees them", () => {
    const sections = getClientNavSections(scope({ kind: "personal" }, true));
    expect(sections.map((s) => s.label)).toEqual(["Buying", "Selling", null]);
    expect(getClientNavItems(scope({ kind: "personal" }, true)).map((i) => i.label)).toEqual([
      "My bids",
      "Purchases",
      "Watching",
      "Consignments",
      "Sold & payouts",
      "Notifications",
      "Bid settings",
      "LAX Account",
    ]);
  });

  it("has no Home and no Organisation section", () => {
    const ids = getClientNavItems(scope({ kind: "personal" }, true)).map((i) => i.id);
    expect(ids).not.toContain("home");
    expect(ids).not.toContain("organisation");
  });
});

describe("menu sections, organisation roles", () => {
  const cases: [LegalEntityMemberRole, Record<string, string[]>][] = [
    [
      "owner",
      {
        home: ["home"],
        buying: ["bids", "purchases", "watchlist"],
        selling: ["consignments", "payouts"],
        collection: ["works"],
        organisation: ["team", "organisation"],
        account: ACCOUNT,
      },
    ],
    [
      "admin",
      {
        home: ["home"],
        buying: ["bids", "purchases", "watchlist"],
        selling: ["consignments", "payouts"],
        collection: ["works"],
        organisation: ["team", "organisation"],
        account: ACCOUNT,
      },
    ],
    [
      "buyer_agent",
      {
        home: ["home"],
        buying: ["bids", "purchases", "watchlist"],
        collection: ["works"],
        account: ACCOUNT,
      },
    ],
    [
      "consignor",
      {
        home: ["home"],
        buying: ["watchlist"],
        selling: ["consignments"],
        account: ACCOUNT,
      },
    ],
    [
      "finance",
      {
        home: ["home"],
        buying: ["purchases"],
        selling: ["consignments", "payouts"],
        collection: ["works"],
        organisation: ["organisation"],
        account: ACCOUNT,
      },
    ],
    [
      "viewer",
      {
        home: ["home"],
        selling: ["consignments"],
        collection: ["works"],
        account: ACCOUNT,
      },
    ],
  ];

  it.each(cases)("%s", (role, expected) => {
    expect(menu(scope(org(role)))).toEqual(expected);
  });

  it("never offers Sell with LAX inside an organisation", () => {
    for (const role of legalEntityMemberRoles) {
      expect(getClientNavItems(scope(org(role))).map((i) => i.id)).not.toContain("sell");
    }
  });

  it("names an organisation's bids without 'My'", () => {
    expect(getClientNavItems(scope(org("owner"))).find((i) => i.id === "bids")?.label).toBe("Bids");
  });

  it("shows bidding pages only to roles the capability table lets bid", () => {
    for (const role of legalEntityMemberRoles) {
      const ids = getClientNavItems(scope(org(role))).map((i) => i.id);
      expect(ids.includes("bids")).toBe(entityRoleCan(role, "entity.bid.place"));
    }
  });
});

describe("menu links", () => {
  it("links LAX Account to the Account origin as an external link", () => {
    const entry = getClientNavItems(scope({ kind: "personal" })).find(
      (i) => i.id === "lax-account",
    );
    expect(entry).toMatchObject({ href: laxAccountHomeUrl(), external: true });
    expect(entry?.match?.("/anything")).toBe(false);
  });

  it("uses the clean addresses", () => {
    const hrefs = Object.fromEntries(
      getClientNavItems(scope(org("owner"))).map((i) => [i.id, i.href]),
    );
    expect(hrefs).toMatchObject({
      home: "/home",
      bids: "/bids",
      purchases: "/purchases",
      watchlist: "/watching",
      consignments: "/selling/consignments",
      works: "/collection",
      team: "/team",
      payouts: "/selling/payouts",
      organisation: "/organisation",
      settings: "/settings",
    });
  });
});

describe("active entry", () => {
  function activeId(navScope: ClientNavScope, pathname: string): string | undefined {
    return getClientNavItems(navScope).find((i) =>
      i.match ? i.match(pathname) : i.href === pathname,
    )?.id;
  }

  it("treats a consignment and a new submission as Consignments", () => {
    const personal = scope({ kind: "personal" }, true);
    expect(activeId(personal, "/selling/consignments/s1")).toBe("consignments");
    expect(activeId(personal, "/selling/new")).toBe("consignments");
  });

  it("highlights every Organisation tab and Bid settings across its tree", () => {
    expect(activeId(scope(org("owner")), "/organisation/members")).toBe("organisation");
    expect(activeId(scope(org("owner")), "/settings/notifications")).toBe("settings");
  });

  it("treats payout setup and statements as Sold & payouts", () => {
    const personal = scope({ kind: "personal" }, true);
    expect(activeId(personal, "/selling/payout-setup")).toBe("payouts");
    expect(activeId(personal, "/legal-entities/e1/payouts/p1/statement")).toBe("payouts");
  });
});

describe("mobile tabs", () => {
  const tabIds = (navScope: ClientNavScope) => getClientMobileTabs(navScope).map((t) => t.id);

  it("personal: bids, purchases, watching, then More", () => {
    expect(tabIds(scope({ kind: "personal" }))).toEqual([
      "bids",
      "purchases",
      "watchlist",
      "notifications",
      "more",
    ]);
  });

  it.each([
    ["owner", ["home", "bids", "purchases", "consignments", "more"]],
    ["admin", ["home", "bids", "purchases", "consignments", "more"]],
    ["finance", ["home", "purchases", "payouts", "more"]],
    ["buyer_agent", ["home", "bids", "purchases", "watchlist", "more"]],
    ["consignor", ["home", "consignments", "watchlist", "more"]],
    ["viewer", ["home", "consignments", "works", "more"]],
  ] as const)("%s: the role's own tabs, then More", (role, expected) => {
    expect(tabIds(scope(org(role)))).toEqual(expected);
  });

  it("offers a role only tabs its menu has", () => {
    for (const role of legalEntityMemberRoles) {
      const menuIds = getClientNavItems(scope(org(role))).map((i) => i.id);
      for (const id of tabIds(scope(org(role)))) {
        if (id !== "more") expect(menuIds).toContain(id);
      }
    }
  });
});
