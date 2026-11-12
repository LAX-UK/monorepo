import { test as base } from "@playwright/test";
import { withSignOutAfterEach } from "../../../../scripts/ci/e2e-sign-out.mjs";

/**
 * `test` for specs that sign a staff member in themselves: the browser is signed out through
 * LAX Admin's own sign-out when the spec ends, so automated runs do not pile up devices in the
 * account they use.
 */
export const test = withSignOutAfterEach(base);

export { expect } from "@playwright/test";
