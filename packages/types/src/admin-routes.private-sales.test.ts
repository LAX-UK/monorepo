import { describe, expect, it } from "vitest";
import { PRIVATE_SALE_DEALS_READ_ACCESS } from "./admin-access.js";
import { adminRoutes, canOpenAdminLink, resolveAdminRoute } from "./admin-routes.js";
import { userHasAccessTo } from "./role-policy.js";
import { userStaffRoles } from "./user.js";

/**
 * The deal page is what the "unapplied money" and "seller payout may need adjusting" alerts link
 * to. Whoever can read deals must be able to open that link, Finance-only staff included, and
 * nobody else must.
 */
describe("the link to a private sale deal", () => {
  const href = adminRoutes.privateSales.deal("PS-0012");

  it("resolves to a route in the table, in the shared area", () => {
    expect(resolveAdminRoute(href)).toMatchObject({
      pattern: "/admin/private-sales/[reference]",
      area: "shared",
    });
  });

  it("opens for Finance-only staff", () => {
    expect(canOpenAdminLink("staff", ["finance"], href)).toBe(true);
  });

  it.each(userStaffRoles)("opens for a lone %s exactly when they can read deals", (role) => {
    expect(canOpenAdminLink("staff", [role], href)).toBe(
      userHasAccessTo("staff", [role], PRIVATE_SALE_DEALS_READ_ACCESS),
    );
  });

  it("does not open for a client, or for staff with no role", () => {
    expect(canOpenAdminLink("client", [], href)).toBe(false);
    expect(canOpenAdminLink("staff", [], href)).toBe(false);
  });
});
