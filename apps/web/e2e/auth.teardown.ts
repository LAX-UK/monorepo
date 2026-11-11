import { test as teardown } from "@playwright/test";
import { signOutStorageStates } from "../../../scripts/ci/e2e-sign-out.mjs";
import { roleAuthState } from "./helpers/auth-state";

teardown.setTimeout(240_000);

/**
 * Signs out every saved sign-in through the Bid sign-out, so the sign-in service ends each session.
 * The prepare step (scripts/ci/prepare-e2e-auth-states.mjs) keeps the files for the run that
 * follows, so it sets PLAYWRIGHT_KEEP_AUTH_STATE; `pnpm test:e2e:sign-out` then ends them.
 */
teardown("sign out the saved sessions", async ({ browser, baseURL }) => {
  teardown.skip(
    process.env.PLAYWRIGHT_E2E !== "1" || process.env.PLAYWRIGHT_KEEP_AUTH_STATE === "1",
    "Saved sessions are kept for the run that follows.",
  );
  const failures = await signOutStorageStates(browser, {
    files: Object.values(roleAuthState),
    origin: baseURL ?? "http://localhost:3000",
  });
  for (const failure of failures) console.warn(`[e2e] could not sign out ${failure}`);
});
