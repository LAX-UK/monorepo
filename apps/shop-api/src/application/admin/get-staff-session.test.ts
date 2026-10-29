import { capabilitiesForRoles } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { getStaffSessionView } from "./get-staff-session.js";

const featureFlags = {
  read: () => ({
    payouts: true,
    thirdPartySales: false,
    originalSales: false,
    merchandise: false,
  }),
};

describe("getStaffSessionView", () => {
  it("maps role capabilities and feature flags", () => {
    const view = getStaffSessionView({
      subject: "sub-1",
      roles: ["finance"],
      capabilities: capabilitiesForRoles(["finance"]),
      featureFlags,
    });
    expect(view.subject).toBe("sub-1");
    expect(view.role).toBe("finance");
    expect(view.capabilities).toContain("payout.mark_paid");
    expect(view.features.payouts).toBe(true);
  });

  it("carries every role in force and the union of their capabilities", () => {
    const roles = ["catalogue_editor", "editor"] as const;
    const view = getStaffSessionView({
      subject: "sub-2",
      roles,
      capabilities: capabilitiesForRoles(roles),
      featureFlags,
    });
    expect(view.role).toBe("catalogue_editor");
    expect(view.roles).toEqual(["catalogue_editor", "editor"]);
    expect([...view.capabilities].sort()).toEqual(
      [
        "catalogue.read",
        "catalogue.write",
        "editorial.read",
        "editorial.write",
        "editorial.publish",
        "artist_application.review",
      ].sort(),
    );
  });
});
