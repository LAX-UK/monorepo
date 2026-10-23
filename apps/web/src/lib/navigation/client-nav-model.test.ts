import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { entityRoleCan } from "@auction/domain";
import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type ClientNavContext,
  type ClientNavInput,
  getClientMobileTabs,
  getClientNavItems,
} from "./client-nav-model";

const ORG_ID = "org-1";
const personal: ClientNavContext = { kind: "personal" };

function input(overrides: Partial<ClientNavInput> = {}): ClientNavInput {
  return {
    mode: "buying",
    context: personal,
    orgModuleEnabled: true,
    isOrgMember: false,
    ...overrides,
  };
}

function ids(overrides: Partial<ClientNavInput> = {}): string[] {
  return getClientNavItems(input(overrides)).map((item) => item.id);
}

function org(role: LegalEntityMemberRole): ClientNavContext {
  return { kind: "organisation", id: ORG_ID, role };
}

describe("buying nav, personal account", () => {
  it("offers the everyday pages and Bid settings, with no dashboard or duplicates", () => {
    expect(ids()).toEqual([
      "bids",
      "purchases",
      "watchlist",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("links LAX Account to the Account origin as an external link in both modes", () => {
    for (const mode of ["buying", "selling"] as const) {
      const entry = getClientNavItems(input({ mode })).find((item) => item.id === "lax-account");
      expect(entry).toMatchObject({ href: laxAccountHomeUrl(), external: true });
    }
  });

  it("opens the Bid settings list from the settings entry", () => {
    const entry = getClientNavItems(input()).find((item) => item.id === "settings");
    expect(entry?.href).toBe("/dashboard/settings");
  });

  it("uses one name per page", () => {
    const labels = getClientNavItems(input()).map((item) => item.label);
    expect(labels).toEqual([
      "My bids",
      "Purchases",
      "Watching",
      "Notifications",
      "Bid settings",
      "LAX Account",
    ]);
  });

  it("adds Your organisations only for members when the module is on", () => {
    expect(ids({ isOrgMember: true })).toContain("organisations");
    expect(ids({ isOrgMember: false })).not.toContain("organisations");
    expect(ids({ isOrgMember: true, orgModuleEnabled: false })).not.toContain("organisations");
  });

  it("keeps Invitations out of the nav entirely", () => {
    for (const mode of ["buying", "selling"] as const) {
      expect(ids({ mode, isOrgMember: true })).not.toContain("invitations");
    }
  });
});

describe("selling nav, personal account", () => {
  it("lists the selling pages in order, with no organisation entries", () => {
    expect(ids({ mode: "selling", isOrgMember: true })).toEqual([
      "seller-overview",
      "consignments",
      "payouts",
      "connect",
      "artist",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("names the pages as the seller sees them", () => {
    const labels = getClientNavItems(input({ mode: "selling" })).map((item) => item.label);
    expect(labels).toEqual([
      "Overview",
      "Consignments",
      "Sold & payouts",
      "Payout setup",
      "Artist profile",
      "Notifications",
      "Bid settings",
      "LAX Account",
    ]);
  });

  it("points payout setup at the personal page", () => {
    const connect = getClientNavItems(input({ mode: "selling" })).find((i) => i.id === "connect");
    expect(connect?.href).toBe("/dashboard/seller/connect");
  });
});

describe.each(legalEntityMemberRoles)("organisation context, role %s", (role) => {
  const context = org(role);

  it("shows Purchases only to roles that can read holdings or finance", () => {
    const expected =
      entityRoleCan(role, "entity.holdings.read") || entityRoleCan(role, "entity.finance.read");
    expect(ids({ context, isOrgMember: true }).includes("purchases")).toBe(expected);
  });

  it("always keeps bids, watching, notifications and settings", () => {
    expect(ids({ context, isOrgMember: true })).toEqual(
      expect.arrayContaining(["bids", "watchlist", "notifications", "settings"]),
    );
  });

  it("gates each selling page on its capability and hides the artist profile", () => {
    const selling = ids({ mode: "selling", context, isOrgMember: true });
    const has = (id: string) => selling.includes(id);
    expect(has("seller-overview")).toBe(entityRoleCan(role, "entity.consignments.read"));
    expect(has("consignments")).toBe(entityRoleCan(role, "entity.consignments.read"));
    expect(has("works")).toBe(
      entityRoleCan(role, "entity.holdings.read") || entityRoleCan(role, "entity.finance.read"),
    );
    expect(has("payouts")).toBe(entityRoleCan(role, "entity.payouts.read"));
    expect(has("connect")).toBe(entityRoleCan(role, "entity.connect.operate"));
    expect(has("org-members")).toBe(entityRoleCan(role, "entity.members.manage"));
    expect(has("org-documents")).toBe(entityRoleCan(role, "entity.members.manage"));
    expect(has("org-security")).toBe(entityRoleCan(role, "entity.security.manage"));
    expect(has("org-details")).toBe(true);
    expect(has("artist")).toBe(false);
  });

  it("never offers a selling page the capability matrix would refuse", () => {
    const selling = ids({ mode: "selling", context, isOrgMember: true });
    const needs: Record<string, Parameters<typeof entityRoleCan>[1][]> = {
      "seller-overview": ["entity.consignments.read"],
      consignments: ["entity.consignments.read"],
      works: ["entity.holdings.read", "entity.finance.read"],
      payouts: ["entity.payouts.read"],
      connect: ["entity.connect.operate"],
      "org-members": ["entity.members.manage"],
      "org-documents": ["entity.members.manage"],
      "org-security": ["entity.security.manage"],
    };
    for (const [id, capabilities] of Object.entries(needs)) {
      if (selling.includes(id)) {
        expect(capabilities.some((c) => entityRoleCan(role, c))).toBe(true);
      }
    }
  });
});

describe("organisation context, specific roles", () => {
  it("a consignor sees consignments but no purchases, works, payouts or payout setup", () => {
    const context = org("consignor");
    expect(ids({ context })).not.toContain("purchases");
    expect(ids({ mode: "selling", context })).toEqual([
      "seller-overview",
      "consignments",
      "org-details",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("a viewer sees works and consignments but no money, members or policy pages", () => {
    const context = org("viewer");
    expect(ids({ context })).toContain("purchases");
    expect(ids({ mode: "selling", context })).toEqual([
      "seller-overview",
      "consignments",
      "works",
      "org-details",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("a finance member sees works, payouts and payout setup but cannot manage members", () => {
    expect(ids({ mode: "selling", context: org("finance") })).toEqual([
      "seller-overview",
      "consignments",
      "works",
      "payouts",
      "connect",
      "org-details",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("an admin manages members and documents but not the two-step policy", () => {
    const selling = ids({ mode: "selling", context: org("admin") });
    expect(selling).toEqual(expect.arrayContaining(["org-members", "org-documents"]));
    expect(selling).not.toContain("org-security");
  });

  it("only the owner sees every entry, including the two-step policy", () => {
    expect(ids({ mode: "selling", context: org("owner") })).toEqual([
      "seller-overview",
      "consignments",
      "works",
      "payouts",
      "connect",
      "org-details",
      "org-members",
      "org-documents",
      "org-security",
      "notifications",
      "settings",
      "lax-account",
    ]);
  });

  it("links organisation pages and payout setup to the organisation being sold as", () => {
    const items = getClientNavItems(input({ mode: "selling", context: org("owner") }));
    const hrefOf = (id: string) => items.find((item) => item.id === id)?.href;
    expect(hrefOf("connect")).toBe("/dashboard/seller/organisations/org-1/connect");
    expect(hrefOf("org-details")).toBe("/dashboard/seller/organisations/org-1");
    expect(hrefOf("org-members")).toBe("/dashboard/seller/organisations/org-1/members");
    expect(hrefOf("org-documents")).toBe("/dashboard/seller/organisations/org-1/documents");
    expect(hrefOf("org-security")).toBe("/dashboard/seller/organisations/org-1/security");
  });

  it("keeps organisation entries out of buying mode", () => {
    const buying = ids({ context: org("owner"), isOrgMember: true });
    expect(buying).not.toContain("org-members");
    expect(buying).not.toContain("works");
  });
});

describe("nav matching", () => {
  const items = getClientNavItems(input({ isOrgMember: true }));
  const activeId = (pathname: string) =>
    items.find((item) => (item.match ? item.match(pathname) : pathname.startsWith(item.href)))?.id;

  it("highlights Purchases on its page and nested routes", () => {
    expect(activeId("/dashboard/purchases")).toBe("purchases");
  });

  it("highlights Your organisations on the list and for invitations", () => {
    expect(activeId("/dashboard/organisations")).toBe("organisations");
    expect(activeId("/dashboard/invitations/review")).toBe("organisations");
  });

  it("highlights Bid settings across the settings tree", () => {
    expect(activeId("/dashboard/settings")).toBe("settings");
    expect(activeId("/dashboard/settings/interests")).toBe("settings");
  });

  it("never highlights LAX Account, which is a different site", () => {
    expect(items.find((item) => item.id === "lax-account")?.match?.("/account")).toBe(false);
  });

  it("no longer claims the retired artist-follow route for Watching", () => {
    expect(activeId("/dashboard/artist-follow")).toBeUndefined();
  });

  describe("in Selling mode", () => {
    const selling = getClientNavItems(input({ mode: "selling", context: org("owner") }));
    const sellingActive = (pathname: string) =>
      selling.find((item) => item.match?.(pathname) ?? pathname === item.href)?.id;

    it("keeps Overview exact so it does not shadow the other pages", () => {
      expect(sellingActive("/dashboard/seller")).toBe("seller-overview");
      expect(sellingActive("/dashboard/seller/consignments")).toBe("consignments");
    });

    it("treats a submission page as part of Consignments", () => {
      expect(sellingActive("/dashboard/submissions/abc")).toBe("consignments");
      expect(sellingActive("/dashboard/submissions/new")).toBe("consignments");
    });

    it("highlights the organisation page, tab and payout setup under the organisation", () => {
      expect(sellingActive("/dashboard/seller/organisations/org-1")).toBe("org-details");
      expect(sellingActive("/dashboard/seller/organisations/org-1/profile")).toBe("org-details");
      expect(sellingActive("/dashboard/seller/organisations/org-1/members")).toBe("org-members");
      expect(sellingActive("/dashboard/seller/organisations/org-1/connect")).toBe("connect");
    });
  });
});

describe("mobile tabs", () => {
  it("buying personal: bids, purchases, watching, notifications, more", () => {
    expect(getClientMobileTabs(input()).map((item) => item.id)).toEqual([
      "bids",
      "purchases",
      "watchlist",
      "notifications",
      "more",
    ]);
  });

  it("selling personal: overview, consignments, payouts, notifications, more", () => {
    expect(getClientMobileTabs(input({ mode: "selling" })).map((item) => item.id)).toEqual([
      "seller-overview",
      "consignments",
      "payouts",
      "notifications",
      "more",
    ]);
  });

  it("selling as an owner: the four most useful entries, with Works in place of notifications", () => {
    expect(
      getClientMobileTabs(input({ mode: "selling", context: org("owner") })).map((item) => item.id),
    ).toEqual(["seller-overview", "consignments", "works", "payouts", "more"]);
  });

  it("drops tabs the role cannot open but keeps More", () => {
    const tabs = getClientMobileTabs(input({ context: org("consignor") })).map((item) => item.id);
    expect(tabs).toEqual(["bids", "watchlist", "notifications", "more"]);
  });
});
