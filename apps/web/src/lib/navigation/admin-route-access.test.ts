import { readdirSync } from "node:fs";
import { join } from "node:path";
import { FINANCE_ACCESS, LEGAL_ENTITY_BROWSE_ACCESS, LOTS_ACCESS } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_AREAS,
  adminDenialDestination,
  adminRouteArea,
  canOpenAdminRoute,
  staffRolesThatCanOpen,
} from "./admin-route-access";

const ADMIN_APP = join(__dirname, "../../app/admin");

function sectionsIn(group: string): string[] {
  return readdirSync(join(ADMIN_APP, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe("admin route areas", () => {
  it("matches the route groups on disk, so navigation and guards cannot drift apart", () => {
    for (const section of sectionsIn("(finance)")) {
      expect(ADMIN_ROUTE_AREAS[section], section).toBe("finance");
    }
    for (const section of sectionsIn("(shared)")) {
      expect(ADMIN_ROUTE_AREAS[section], section).toBe("shared");
    }
    for (const section of sectionsIn("(platform)").filter((name) => !name.startsWith("("))) {
      expect(ADMIN_ROUTE_AREAS[section], section).toBeUndefined();
    }
  });

  it("reads the area from the first path segment, ignoring the query", () => {
    expect(adminRouteArea("/admin/payouts/settlement")).toBe("finance");
    expect(adminRouteArea("/admin/audit?actor=x")).toBe("shared");
    expect(adminRouteArea("/admin/legal-entities/123")).toBe("platform");
    expect(adminRouteArea("/admin")).toBe("platform");
  });
});

describe("canOpenAdminRoute", () => {
  it("keeps finance out of platform pages even where it holds the capability", () => {
    expect(
      canOpenAdminRoute(
        "staff",
        "finance_ops",
        "/admin/legal-entities",
        LEGAL_ENTITY_BROWSE_ACCESS,
      ),
    ).toBe(false);
    expect(canOpenAdminRoute("staff", "finance_ops", "/admin/payments", FINANCE_ACCESS)).toBe(true);
    expect(canOpenAdminRoute("staff", "finance_ops", "/admin/audit")).toBe(true);
  });

  it("needs both the route group and the capability", () => {
    expect(canOpenAdminRoute("staff", "staff_viewer", "/admin/lots", LOTS_ACCESS)).toBe(false);
    expect(canOpenAdminRoute("staff", "catalogue_manager", "/admin/lots", LOTS_ACCESS)).toBe(true);
    expect(canOpenAdminRoute("client", null, "/admin/audit")).toBe(false);
  });
});

describe("staffRolesThatCanOpen", () => {
  it("names the roles that can open a page", () => {
    expect(staffRolesThatCanOpen("/admin/payments", FINANCE_ACCESS)).toEqual(["Finance"]);
    expect(staffRolesThatCanOpen("/admin/lots", LOTS_ACCESS)).toContain("Catalogue manager");
    expect(staffRolesThatCanOpen("/admin/lots", LOTS_ACCESS)).not.toContain("Super admin");
  });
});

describe("adminDenialDestination", () => {
  it("sends a role that cannot use the admin home to its own overview", () => {
    expect(adminDenialDestination("staff", "finance_ops", "/admin")).toBe("/admin/finance");
    expect(adminDenialDestination("staff", "finance_ops", "/admin?period=7")).toBe(
      "/admin/finance",
    );
  });

  it("explains any other page, keeping the address asked for", () => {
    expect(adminDenialDestination("staff", "finance_ops", "/admin/sales?status=live")).toBe(
      `/admin/no-access?from=${encodeURIComponent("/admin/sales?status=live")}`,
    );
  });

  it("never loops back to the admin home when that is the role's overview", () => {
    expect(adminDenialDestination("staff", "staff_viewer", "/admin")).not.toBe("/admin");
  });
});
