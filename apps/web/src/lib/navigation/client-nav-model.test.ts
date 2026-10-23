import { entityRoleCan } from "@auction/domain";
import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type ClientNavContext,
  type ClientNavInput,
  getClientMobileTabs,
  getClientNavItems,
} from "./client-nav-model";

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

describe("buying nav, personal account", () => {
  it("offers the everyday pages and Bid settings, with no dashboard or duplicates", () => {
    expect(ids()).toEqual(["bids", "purchases", "watchlist", "notifications", "settings"]);
  });

  it("uses one name per page", () => {
    const labels = getClientNavItems(input()).map((item) => item.label);
    expect(labels).toEqual(["My bids", "Purchases", "Watching", "Notifications", "Bid settings"]);
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
  it("lists the seller pages without organisation duplicates", () => {
    expect(ids({ mode: "selling", isOrgMember: true })).toEqual([
      "seller-overview",
      "submissions",
      "in-sale",
      "payouts",
      "connect",
      "artist",
      "notifications",
      "settings",
    ]);
  });
});

describe.each(legalEntityMemberRoles)("organisation context, role %s", (role) => {
  const context: ClientNavContext = { kind: "organisation", role };

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

  it("gates each seller page on its capability and hides the artist profile", () => {
    const selling = ids({ mode: "selling", context, isOrgMember: true });
    expect(selling.includes("seller-overview")).toBe(
      entityRoleCan(role, "entity.consignments.read"),
    );
    expect(selling.includes("submissions")).toBe(entityRoleCan(role, "entity.consignments.read"));
    expect(selling.includes("in-sale")).toBe(entityRoleCan(role, "entity.consignments.read"));
    expect(selling.includes("payouts")).toBe(entityRoleCan(role, "entity.payouts.read"));
    expect(selling.includes("connect")).toBe(entityRoleCan(role, "entity.connect.operate"));
    expect(selling).not.toContain("artist");
  });
});

describe("organisation context, specific roles", () => {
  it("a consignor sees consignments but no purchases, payouts or payout setup", () => {
    const context: ClientNavContext = { kind: "organisation", role: "consignor" };
    expect(ids({ context })).not.toContain("purchases");
    const selling = ids({ mode: "selling", context });
    expect(selling).toContain("in-sale");
    expect(selling).not.toContain("payouts");
    expect(selling).not.toContain("connect");
  });

  it("a viewer sees works and consignments but no money pages", () => {
    const context: ClientNavContext = { kind: "organisation", role: "viewer" };
    expect(ids({ context })).toContain("purchases");
    const selling = ids({ mode: "selling", context });
    expect(selling).toContain("in-sale");
    expect(selling).not.toContain("payouts");
  });

  it("a finance member sees payouts and payout setup", () => {
    const context: ClientNavContext = { kind: "organisation", role: "finance" };
    const selling = ids({ mode: "selling", context });
    expect(selling).toEqual(expect.arrayContaining(["payouts", "connect"]));
  });
});

describe("nav matching", () => {
  const items = getClientNavItems(input({ isOrgMember: true }));
  const activeId = (pathname: string) =>
    items.find((item) => (item.match ? item.match(pathname) : pathname.startsWith(item.href)))?.id;

  it("highlights Purchases on its page and nested routes", () => {
    expect(activeId("/dashboard/purchases")).toBe("purchases");
  });

  it("highlights Your organisations for organisation and invitation routes", () => {
    expect(activeId("/dashboard/organisations/abc/members")).toBe("organisations");
    expect(activeId("/dashboard/invitations/review")).toBe("organisations");
  });

  it("highlights Bid settings across the settings tree", () => {
    expect(activeId("/dashboard/settings/interests")).toBe("settings");
  });

  it("no longer claims the retired artist-follow route for Watching", () => {
    expect(activeId("/dashboard/artist-follow")).toBeUndefined();
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

  it("selling personal: overview, submissions, items in sale, notifications, more", () => {
    expect(getClientMobileTabs(input({ mode: "selling" })).map((item) => item.id)).toEqual([
      "seller-overview",
      "submissions",
      "in-sale",
      "notifications",
      "more",
    ]);
  });

  it("drops tabs the role cannot open but keeps More", () => {
    const tabs = getClientMobileTabs(
      input({ context: { kind: "organisation", role: "consignor" } }),
    ).map((item) => item.id);
    expect(tabs).toEqual(["bids", "watchlist", "notifications", "more"]);
  });
});
