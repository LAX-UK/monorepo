import {
  SHOP_STAFF_CAPABILITIES,
  type ShopStaffRole,
  capabilitiesForRole,
} from "@auction/shop-domain";
import { expect, test } from "@playwright/test";
import { buildAdminNavGroups, flattenAdminNav } from "../src/server/domain/admin-nav.vm.js";
import type { AdminSessionFeatures } from "./support/feature-gate.js";
import { ALL_FEATURES } from "./support/lax-admin-pages.js";
import {
  type StaffSession,
  e2eEnabled,
  openStaffPage,
  openStaffSession,
} from "./support/page-session.js";

/**
 * The six LAX Admin sign-ins the demo top-up creates (packages/db/src/seed/demo/demo-topup-ids.ts),
 * each granted one role with `staff:grant`. All share the demo password.
 */
const ROLE_ACCOUNTS: ReadonlyArray<{ role: ShopStaffRole; email: string }> = [
  { role: "operations", email: "lax-operations@lax.bid" },
  { role: "editor", email: "lax-editor@lax.bid" },
  { role: "catalogue_editor", email: "lax-catalogue@lax.bid" },
  { role: "finance", email: "lax-finance@lax.bid" },
  { role: "account_manager", email: "lax-accounts@lax.bid" },
  { role: "read_only", email: "lax-readonly@lax.bid" },
];

const password = process.env.LAX_ADMIN_ROLES_PASSWORD ?? "Password123!";
const rolesEnabled = process.env.LAX_ADMIN_ROLES_E2E === "1";

const everyNavPath = new Set(
  flattenAdminNav(
    buildAdminNavGroups({ capabilities: SHOP_STAFF_CAPABILITIES, features: ALL_FEATURES }),
  ).map((item) => item.href),
);

test.describe("LAX Admin staff roles @roles", () => {
  test.setTimeout(120_000);
  test.skip(
    !e2eEnabled || !rolesEnabled,
    "Set PLAYWRIGHT_E2E=1 and LAX_ADMIN_ROLES_E2E=1 against an environment with the demo top-up and its LAX Admin roles granted.",
  );

  for (const { role, email } of ROLE_ACCOUNTS) {
    test(`${role} signs in and sees only the pages its capabilities allow`, async ({
      browser,
      baseURL,
    }) => {
      if (!baseURL) throw new Error("baseURL is required");
      let session: StaffSession | undefined;
      try {
        session = await openStaffSession({
          browser,
          baseURL,
          account: { email, password },
          theme: "light",
          viewport: { width: 1440, height: 1000 },
        });
        const { page } = session;
        await openStaffPage(page, "/overview");

        // The pages a flag switches on or off depend on the environment, so read the flags the
        // session itself reports and expect the nav the capability map gives with them.
        const sessionResponse = await page.request.get("/api/admin/session");
        expect(sessionResponse.ok()).toBe(true);
        const { features } = (await sessionResponse.json()) as { features: AdminSessionFeatures };
        const expected = flattenAdminNav(
          buildAdminNavGroups({ capabilities: capabilitiesForRole(role), features }),
        )
          .map((item) => item.href)
          .sort();

        const hrefs = await page
          .locator("[data-staff-shell] nav a[href]")
          .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
        const shown = [...new Set(hrefs.filter((href) => everyNavPath.has(href)))].sort();

        expect(shown).toEqual(expected);
      } finally {
        await session?.context.close();
      }
    });
  }
});
