import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";
import {
  buyerLogin,
  catalogueManagerLogin,
  clientLogin,
  e2eEnabled,
  financeLogin,
  hasBuyerCredentials,
  hasCatalogueManagerCredentials,
  hasClientCredentials,
  hasFinanceCredentials,
  hasIncompleteCredentials,
  hasOperationsCredentials,
  hasReadonlyCredentials,
  hasStaffCredentials,
  hasUnapprovedCredentials,
  hasZeroLotCredentials,
  incompleteLogin,
  operationsLogin,
  readonlyStaffLogin,
  staffLogin,
  unapprovedLogin,
  zeroLotLogin,
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

setup("authenticate staff @setup-staff", async ({ page, browser }) => {
  setup.skip(!e2eEnabled || !hasStaffCredentials(), "Seeded staff credentials are required.");
  await staffLogin(page);
  await page.context().storageState({ path: roleAuthState.staff });

  for (const extraPath of [roleAuthState.staffRoles, roleAuthState.staffPublic]) {
    flushAuthRateLimits();
    const extraContext = await browser.newContext();
    const extraPage = await extraContext.newPage();
    await staffLogin(extraPage);
    await extraContext.storageState({ path: extraPath });
    await extraContext.close();
  }
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

setup("authenticate complete client @setup-client", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasClientCredentials(),
    "Seeded complete-client credentials are required.",
  );
  await clientLogin(page);
  await page.context().storageState({ path: roleAuthState.client });
});

setup("authenticate unapproved buyer @setup-unapproved", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasUnapprovedCredentials(),
    "Seeded unapproved-buyer credentials are required.",
  );
  await unapprovedLogin(page);
  await page.context().storageState({ path: roleAuthState.unapproved });
});

setup("authenticate incomplete buyer @setup-incomplete", async ({ page }) => {
  setup.skip(
    !e2eEnabled || !hasIncompleteCredentials(),
    "Seeded incomplete-buyer credentials are required.",
  );
  await incompleteLogin(page);
  await page.context().storageState({ path: roleAuthState.incomplete });
});

setup("authenticate zero-lot buyer @setup-zero-lot", async ({ page }) => {
  setup.skip(!e2eEnabled || !hasZeroLotCredentials(), "Seeded zero-lot credentials are required.");
  await zeroLotLogin(page);
  await page.context().storageState({ path: roleAuthState.zeroLot });
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
