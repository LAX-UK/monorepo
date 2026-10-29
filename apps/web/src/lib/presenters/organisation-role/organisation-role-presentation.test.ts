import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  organisationRoleDescription,
  organisationRoleGroupsSentence,
  organisationRoleInSentence,
  organisationRoleLabel,
  organisationRoleOptions,
} from "./organisation-role-presentation";

describe("organisation role words", () => {
  it.each([
    ["owner", "Owner", "an owner"],
    ["admin", "Admin", "an admin"],
    ["finance", "Finance", "a finance member"],
    ["consignor", "Consignor", "a consignor"],
    ["buyer_agent", "Buyer agent", "a buyer agent"],
    ["viewer", "Viewer", "a viewer"],
  ] as const)("reads %s as %s, and %s in a sentence", (role, label, phrase) => {
    expect(organisationRoleLabel(role)).toBe(label);
    expect(organisationRoleInSentence(role)).toBe(phrase);
  });

  it.each(legalEntityMemberRoles)("gives %s a one-line description in plain words", (role) => {
    const description = organisationRoleDescription(role);
    expect(description).toMatch(/^[A-Z].*\.$/);
    expect(description).not.toMatch(/_|KYB|Stripe|Connect|2FA/);
  });

  it.each(legalEntityMemberRoles)("writes %s in sentence case, never as its value", (role) => {
    const label = organisationRoleLabel(role);
    expect(label).not.toContain("_");
    expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
  });

  it("humanises a value from outside the list rather than showing it raw", () => {
    expect(organisationRoleLabel("gallery_curator")).toBe("Gallery curator");
    expect(organisationRoleInSentence("gallery_curator")).toBe("a gallery curator");
    expect(organisationRoleInSentence("art_handler")).toBe("an art handler");
  });

  it("names who holds roles as a sentence opening", () => {
    expect(organisationRoleGroupsSentence(["owner"])).toBe("Owners");
    expect(organisationRoleGroupsSentence(["owner", "admin"])).toBe("Owners and admins");
    expect(organisationRoleGroupsSentence(["owner", "admin", "finance"])).toBe(
      "Owners, admins and finance",
    );
    expect(organisationRoleGroupsSentence(["buyer_agent"])).toBe("Buyer agents");
  });

  it("builds picker options in the order given", () => {
    expect(organisationRoleOptions(["viewer", "buyer_agent"])).toEqual([
      { value: "viewer", label: "Viewer" },
      { value: "buyer_agent", label: "Buyer agent" },
    ]);
  });
});
