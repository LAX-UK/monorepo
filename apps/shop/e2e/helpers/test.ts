import { test as base } from "@playwright/test";
import { withSignOutAfterEach } from "../../../../scripts/ci/e2e-sign-out.mjs";

/**
 * `test` for specs that sign in themselves: whatever a spec signs in through the sign-in helper
 * is signed out through the account menu when the spec ends, so automated runs do not pile up
 * devices in the accounts they use.
 */
export const test = withSignOutAfterEach(base);

export { expect } from "@playwright/test";
