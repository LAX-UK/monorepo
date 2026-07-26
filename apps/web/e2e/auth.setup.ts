import { test as setup } from "@playwright/test";
import {
  buyerLogin,
  catalogueManagerLogin,
  e2eEnabled,
  hasBuyerCredentials,
  hasCatalogueManagerCredentials,
  hasStaffCredentials,
  staffLogin,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

setup.describe.configure({ mode: "serial" });

setup("authenticate staff @setup-staff", async ({ page }) => {
  setup.skip(!e2eEnabled || !hasStaffCredentials(), "Seeded staff credentials are required.");
  await staffLogin(page);
  await page.context().storageState({ path: roleAuthState.staff });
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
