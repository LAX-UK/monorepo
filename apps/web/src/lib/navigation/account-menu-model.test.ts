import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type AccountMenuFacts, buildAccountMenu } from "./account-menu-model";

function facts(overrides: Partial<AccountMenuFacts> = {}): AccountMenuFacts {
  return {
    hasConsigned: false,
    isOrgMember: false,
    user: { role: "client", staffRole: null },
    ...overrides,
  };
}

function labels(overrides: Partial<AccountMenuFacts> = {}): string[][] {
  return buildAccountMenu(facts(overrides)).map((group) => group.map((entry) => entry.label));
}

describe("buildAccountMenu", () => {
  it("has no Dashboard entry and puts the everyday pages first", () => {
    const [primary] = labels();
    expect(primary).toEqual(["My bids", "Purchases", "Watching", "Notifications"]);
    expect(labels().flat()).not.toContain("Dashboard");
  });

  it("offers Sell with LAX to people who have never consigned", () => {
    expect(labels()[1]).toEqual(["Sell with LAX"]);
    const entry = buildAccountMenu(facts())[1]?.[0];
    expect(entry?.href).toBe("/selling/new");
  });

  it("offers Selling once the person has consigned", () => {
    expect(labels({ hasConsigned: true })[1]).toEqual(["Selling"]);
  });

  it("offers Selling and Your organisations to organisation members", () => {
    expect(labels({ isOrgMember: true })[1]).toEqual(["Selling", "Your organisations"]);
  });

  it("ends with LAX Account, Bid settings in that order", () => {
    expect(labels()[2]).toEqual(["LAX Account", "Bid settings"]);
  });

  it("links LAX Account to the Account origin as an external link", () => {
    const entry = buildAccountMenu(facts())[2]?.[0];
    expect(entry).toMatchObject({ href: laxAccountHomeUrl(), external: true });
    expect(entry?.href).toMatch(/\/account\?from=bid$/);
  });

  it("opens the Bid settings list, not a single settings page", () => {
    expect(buildAccountMenu(facts())[2]?.[1]?.href).toBe("/settings");
  });

  it("has no admin entry for clients", () => {
    expect(labels().flat()).not.toContain("Admin panel");
    expect(labels().flat()).not.toContain("Finance admin");
  });

  it("keeps the menu to about six everyday entries for a typical buyer", () => {
    expect(labels().flat()).toHaveLength(7);
  });
});

describe("buildAccountMenu for staff", () => {
  const menuFor = (staffRole: UserStaffRole | null) =>
    buildAccountMenu(facts({ user: { role: "staff", staffRole }, isOrgMember: true }));

  it("gives a super admin the admin panel and LAX Account, nothing from the client area", () => {
    const groups = menuFor("super_admin");
    expect(groups.map((g) => g.map((e) => e.label))).toEqual([["Admin panel"], ["LAX Account"]]);
    expect(groups[0]?.[0]?.href).toBe("/admin");
  });

  it("sends finance-only staff to Finance admin", () => {
    expect(menuFor("finance_ops")[0]?.[0]).toMatchObject({
      label: "Finance admin",
      href: "/admin/finance",
    });
  });

  it("sends a clerk to the admin area their role opens first", () => {
    expect(menuFor("auction_manager")[0]?.[0]).toMatchObject({
      label: "Admin panel",
      href: "/admin/sales",
    });
  });

  it("offers only LAX Account to a staff account with no admin role", () => {
    expect(menuFor(null).map((g) => g.map((e) => e.label))).toEqual([["LAX Account"]]);
  });

  it("never offers buying, selling, watching, notifications or Bid settings to staff", () => {
    const labels = menuFor("super_admin")
      .flat()
      .map((e) => e.label);
    for (const clientEntry of [
      "My bids",
      "Purchases",
      "Watching",
      "Notifications",
      "Sell with LAX",
      "Selling",
      "Your organisations",
      "Bid settings",
    ]) {
      expect(labels).not.toContain(clientEntry);
    }
  });
});
