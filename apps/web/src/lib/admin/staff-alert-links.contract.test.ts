import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { adminRouteArea } from "@/lib/navigation/admin-route-access";
import {
  ADMIN_ROUTE_TABLE,
  canOpenAdminLink,
  resolveAdminRoute,
  userHasAccessTo,
  userStaffRoles,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import { STAFF_HEADER_ATTENTION_SPECS } from "./build-staff-header-attention-items";
import { HUB_QUICK_LINK_SPECS } from "./dashboard-access";
import { getDashboardProfile, listDashboardProfiles } from "./dashboard-profile-registry";

/**
 * Contract for the links in the Bid admin's staff alerts: the header bell, the dashboard queue
 * and quick links, and the route table that the API and the notification emails build against.
 * A link that is not in the table, or that sends someone who can see it to a page they cannot
 * open, fails here.
 */

const ADMIN_APP_DIR = join(process.cwd(), "src/app/admin");

/** The page paths under the admin app, with route groups removed and params as `[]`. */
function adminPagePatterns(dir = ADMIN_APP_DIR, prefix = "/admin"): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(name) ? "" : `/${name.replace(/\[\.*\w+\]/, "[]")}`;
      found.push(...adminPagePatterns(full, prefix + segment));
    } else if (name === "page.tsx") {
      found.push(prefix);
    }
  }
  return found;
}

const SOLO_STAFF = userStaffRoles.map((role) => [role] as const);

describe("admin route table", () => {
  const pages = new Set(adminPagePatterns());

  it.each(ADMIN_ROUTE_TABLE.map((entry) => [entry.pattern] as const))(
    "%s is a page in the admin app",
    (pattern) => {
      expect(existsSync(ADMIN_APP_DIR)).toBe(true);
      expect(pages.has(pattern.replace(/\[\w+\]/g, "[]")), pattern).toBe(true);
    },
  );

  it.each(ADMIN_ROUTE_TABLE.map((entry) => [entry.pattern, entry.area] as const))(
    "%s sits in the route group its area names",
    (pattern, area) => {
      expect(adminRouteArea(pattern.replace(/\[\w+\]/g, "x"))).toBe(area);
    },
  );
});

describe("header attention links", () => {
  it.each(STAFF_HEADER_ATTENTION_SPECS.map((spec) => [spec.id, spec] as const))(
    "%s resolves and opens for everyone who sees it",
    (_id, spec) => {
      const { href } = spec.buildItem(2, { ...EMPTY_ADMIN_NAV_COUNTS, privateSalesUrgent: 1 });
      expect(resolveAdminRoute(href), href).toBeDefined();
      for (const staffRoles of SOLO_STAFF) {
        if (!userHasAccessTo("staff", [...staffRoles], spec.requirement)) continue;
        expect(canOpenAdminLink("staff", [...staffRoles], href), `${staffRoles[0]}: ${href}`).toBe(
          true,
        );
      }
    },
  );
});

describe("dashboard links", () => {
  it.each(listDashboardProfiles().map((profile) => [profile.id, profile] as const))(
    "%s primary action resolves and opens for everyone it is offered to",
    (_id, profile) => {
      const { href, requirement } = profile.primaryAction;
      expect(resolveAdminRoute(href), href).toBeDefined();
      for (const staffRoles of SOLO_STAFF) {
        const hasProfile = getDashboardProfile([...staffRoles]).id === profile.id;
        const allowed =
          requirement === null || userHasAccessTo("staff", [...staffRoles], requirement);
        if (!hasProfile || !allowed) continue;
        expect(canOpenAdminLink("staff", [...staffRoles], href), `${staffRoles[0]}: ${href}`).toBe(
          true,
        );
      }
    },
  );

  it.each(HUB_QUICK_LINK_SPECS.map((spec) => [spec.label, spec] as const))(
    "%s quick link resolves and opens for everyone it is offered to",
    (_label, spec) => {
      expect(resolveAdminRoute(spec.href), spec.href).toBeDefined();
      for (const staffRoles of SOLO_STAFF) {
        if (!userHasAccessTo("staff", [...staffRoles], spec.requirement)) continue;
        expect(
          canOpenAdminLink("staff", [...staffRoles], spec.href),
          `${staffRoles[0]}: ${spec.href}`,
        ).toBe(true);
      }
    },
  );
});
