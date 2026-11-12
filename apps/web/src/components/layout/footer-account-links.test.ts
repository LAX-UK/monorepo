import { describe, expect, it } from "vitest";
import { bidFooterAccountLinks } from "./footer-account-links";

describe("bidFooterAccountLinks", () => {
  const labels = (person: Parameters<typeof bidFooterAccountLinks>[0]) =>
    bidFooterAccountLinks(person).map((link) => link.label);

  it("offers a visitor the ways in", () => {
    expect(labels(null)).toEqual([
      "Sign in",
      "Create account",
      "Auction alerts",
      "Client services",
      "FAQ",
    ]);
  });

  it("shows a signed-in client their own pages instead of sign in", () => {
    expect(labels({ role: "client", staffRoles: [] })).toEqual([
      "My bids",
      "Purchases",
      "Watching",
      "Notifications",
      "Client services",
      "FAQ",
    ]);
  });

  it("sends staff, who have no client pages, to LAX Account", () => {
    const staff = labels({ role: "staff", staffRoles: ["finance"] });
    expect(staff).not.toContain("Sign in");
    expect(staff).not.toContain("My bids");
    expect(staff).toContain("LAX Account");
  });
});
