import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { signInStaffThroughIdentity } from "../support/staff-sign-in.js";

/**
 * Signs in the dev-seed accounts that apps/shop-api `seed:local-admin-staff` grants a staff role
 * and saves the browser state per role, so later specs can start already signed in:
 *   test.use({ storageState: "e2e/.auth/finance.json" })
 * Run `pnpm --filter @auction/shop-admin test:e2e:local-setup` while the local stack and
 * scripts/local/start-shop-admin.sh are running. LOCAL_STAFF_PASSWORD is the dev seed password
 * (SEED_PASSWORD in packages/db/src/seed/dev/legacy-demo-seed.ts).
 */
const AUTH_DIR = join(import.meta.dirname, "..", ".auth");
const AUTH_BASE_URL = process.env.OIDC_ISSUER_URL ?? "http://localhost:3003";

const STAFF = [
  { role: "shop_admin", email: "admin@lax.bid" },
  { role: "catalogue_editor", email: "staff-catalogue@lax.bid" },
  { role: "operations", email: "staff-operations@lax.bid" },
  { role: "finance", email: "accountant@lax.bid" },
  { role: "account_manager", email: "staff-advisor@lax.bid" },
  { role: "broker", email: "gallery-admin@lax.bid" },
] as const;

const password = process.env.LOCAL_STAFF_PASSWORD;

for (const { role, email } of STAFF) {
  test(`sign in as ${role}`, async ({ page }) => {
    if (!password) throw new Error("LOCAL_STAFF_PASSWORD is required (the dev seed password)");
    mkdirSync(AUTH_DIR, { recursive: true });
    await signInStaffThroughIdentity({
      page,
      authBaseUrl: AUTH_BASE_URL,
      email,
      password,
      returnTo: "/overview",
    });
    await page.context().storageState({ path: join(AUTH_DIR, `${role}.json`) });
  });
}
