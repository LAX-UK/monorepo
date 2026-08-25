import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";
import {
  formatProbeFailure,
  mintRoleAuthState,
  probeStorageStateFile,
} from "../../../scripts/ci/e2e-session-state.mjs";
import {
  buyerLogin,
  catalogueManagerLogin,
  e2eEnabled,
  financeLogin,
  hasBuyerCredentials,
  hasCatalogueManagerCredentials,
  hasFinanceCredentials,
  hasOperationsCredentials,
  hasReadonlyCredentials,
  hasStaffCredentials,
  operationsLogin,
  readonlyStaffLogin,
  staffLogin,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function flushAuthRateLimits(): void {
  const result = spawnSync("node", [path.join(repoRoot, "scripts/ci/flush-auth-rate-limits.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("failed to flush auth rate-limit keys while minting staff sessions");
  }
}

setup.describe.configure({ mode: "serial" });
setup.setTimeout(90_000);

setup("authenticate staff @setup-staff", async ({ page }) => {
  setup.skip(!e2eEnabled || !hasStaffCredentials(), "Seeded staff credentials are required.");
  await staffLogin(page);
  await page.context().storageState({ path: roleAuthState.staff });
  const staffProbe = await probeStorageStateFile(roleAuthState.staff);
  if (!staffProbe.authenticated) {
    throw new Error(formatProbeFailure("staff", roleAuthState.staff, staffProbe));
  }
  const email = process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid";
  const password = process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!";
  flushAuthRateLimits();
  await mintRoleAuthState({
    role: "staffRoles",
    email,
    password,
    outPath: roleAuthState.staffRoles,
  });
  flushAuthRateLimits();
  await mintRoleAuthState({
    role: "staffPublic",
    email,
    password,
    outPath: roleAuthState.staffPublic,
  });
});

setup("authenticate catalogue manager @setup-catalogue", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasCatalogueManagerCredentials(),
    "Seeded catalogue-manager credentials are required.",
  );
  await catalogueManagerLogin(page);
  await page.context().storageState({ path: roleAuthState.catalogueManager });
});

setup("authenticate buyer @setup-buyer", async ({ page }) => {
  setup.skip(!e2eEnabled || !hasBuyerCredentials(), "Seeded buyer credentials are required.");
  await buyerLogin(page);
  await page.context().storageState({ path: roleAuthState.buyer });
});

setup("authenticate finance @setup-finance", async ({ page }) => {
  setup.skip(!e2eEnabled || !hasFinanceCredentials(), "Seeded finance credentials are required.");
  await financeLogin(page);
  await page.context().storageState({ path: roleAuthState.finance });
});

setup("authenticate read-only staff @setup-readonly", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasReadonlyCredentials(),
    "Seeded read-only staff credentials are required.",
  );
  await readonlyStaffLogin(page);
  await page.context().storageState({ path: roleAuthState.readonlyStaff });
});

setup("authenticate operations @setup-operations", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasOperationsCredentials(),
    "Seeded operations credentials are required.",
  );
  await operationsLogin(page);
  await page.context().storageState({ path: roleAuthState.operations });
});
