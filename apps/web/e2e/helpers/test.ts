import { test as base } from "@playwright/test";
import { withSignOutAfterEach } from "../../../../scripts/ci/e2e-sign-out.mjs";

/**
 * `test` for specs that sign in themselves. Whatever a spec signs in through the login helpers
 * is signed out through Bid's own sign-out when the spec ends, so automated runs do not pile
 * up devices in the accounts they use. Specs that start from a saved session keep using
 * `@playwright/test` (or `auth.fixture`): the saved sessions end in the run's teardown.
 */
export const test = withSignOutAfterEach(base);

export { expect } from "@playwright/test";
