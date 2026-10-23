import { describe, expect, it } from "vitest";
import { type AccountMenuFacts, buildAccountMenu } from "./account-menu-model";

function facts(overrides: Partial<AccountMenuFacts> = {}): AccountMenuFacts {
  return {
    mode: "buying",
    hasConsigned: false,
    isOrgMember: false,
    accountOrigin: "https://account.example.test",
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

  it("offers Start selling to people who have never consigned", () => {
    expect(labels()[1]).toEqual(["Start selling"]);
    const entry = buildAccountMenu(facts())[1]?.[0];
    expect(entry?.href).toBe("/dashboard/submissions/new");
  });

  it("offers Selling once the person has consigned", () => {
    expect(labels({ hasConsigned: true })[1]).toEqual(["Selling"]);
  });

  it("offers Selling and Your organisations to organisation members", () => {
    expect(labels({ isOrgMember: true })[1]).toEqual(["Selling", "Your organisations"]);
  });

  it("offers a way back to buying while selling", () => {
    expect(labels({ mode: "selling", hasConsigned: true })[1]).toEqual(["Back to buying"]);
  });

  it("ends with LAX Account, Bid settings in that order", () => {
    expect(labels()[2]).toEqual(["LAX Account", "Bid settings"]);
  });

  it("links LAX Account to the configured origin as an external link", () => {
    const entry = buildAccountMenu(facts())[2]?.[0];
    expect(entry).toMatchObject({
      href: "https://account.example.test/account?from=bid",
      external: true,
    });
  });

  it("hides LAX Account when no origin is configured", () => {
    expect(labels({ accountOrigin: null })[2]).toEqual(["Bid settings"]);
  });

  it("adds the staff entry for platform admins and finance staff only", () => {
    expect(labels({ user: { role: "staff", staffRole: "super_admin" } })[1]).toContain(
      "Admin panel",
    );
    expect(labels()[1]).not.toContain("Admin panel");
    expect(labels()[1]).not.toContain("Finance admin");
  });

  it("keeps the menu to about six everyday entries for a typical buyer", () => {
    expect(labels().flat()).toHaveLength(7);
  });
});
