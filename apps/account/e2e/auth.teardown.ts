import { test as teardown } from "@playwright/test";
import { signOutStorageStates } from "../../../scripts/ci/e2e-sign-out.mjs";
import { accountAuthState } from "./helpers/account-auth-state";
import { accountE2eEnabled } from "./helpers/account-e2e";

/** Signs out the sessions the setup project saved, so the run leaves no devices behind. */
teardown("sign out the saved sessions", async ({ browser, baseURL }) => {
  teardown.skip(!accountE2eEnabled, "Account browser checks are not enabled.");
  const failures = await signOutStorageStates(browser, {
    files: Object.values(accountAuthState),
    origin: baseURL ?? "http://localhost:3040",
  });
  for (const failure of failures) console.warn(`[e2e] could not sign out ${failure}`);
});
