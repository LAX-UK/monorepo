import { test as setup } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  collectorCredentials,
  newPersonCredentials,
  signInAccount,
} from "./helpers/account-e2e";
import { flushAuthRateLimits } from "./helpers/flush-auth-rate-limits";

setup.describe.configure({ mode: "serial" });

setup("sign in the demo collector", async ({ page }) => {
  setup.skip(!accountE2eEnabled, accountE2eSkipReason);
  const collector = collectorCredentials();
  setup.skip(!collector, "ACCOUNT_E2E_COLLECTOR_EMAIL / _PASSWORD not set");
  if (!collector) return;
  flushAuthRateLimits();
  await signInAccount(page, collector);
  await page.context().storageState({ path: accountAuthState.collector });
});

setup("sign in the person with no data", async ({ page }) => {
  setup.skip(!accountE2eEnabled, accountE2eSkipReason);
  const person = newPersonCredentials();
  setup.skip(!person, "ACCOUNT_E2E_EMPTY_EMAIL / _PASSWORD not set");
  if (!person) return;
  flushAuthRateLimits();
  await signInAccount(page, person);
  await page.context().storageState({ path: accountAuthState.newPerson });
});
