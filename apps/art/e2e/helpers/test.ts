import { test as playwrightTest } from "@playwright/test";
import { withSignOutAfterEach } from "../../../../scripts/ci/e2e-sign-out.mjs";

/**
 * Navigations wait for `domcontentloaded`, not `load`.
 *
 * `load` also waits for every image, font and script request. In CI that event intermittently
 * never fires on catalogue pages, even though the document and assets answer in milliseconds
 * (see the probes in `art-e2e-pr.yml`), and `page.goto` then burns the whole 30 s test budget.
 * What each spec needs is a rendered, interactive page, which its own web-first assertions
 * (`expect(locator).toBeVisible()`) already wait for.
 */
const base = playwrightTest.extend({
  context: async ({ context, baseURL }, use) => {
    // Third-party hosts (analytics, fonts, embeds) are not under test and are unreachable or slow
    // from CI runners; abort them so they can never hold a navigation open.
    const ownOrigin = baseURL ? new URL(baseURL).origin : null;
    await context.route(
      (url) =>
        /^https?:$/.test(url.protocol) &&
        !["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.origin !== ownOrigin,
      (route) => route.abort(),
    );
    await use(context);
  },
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = (url, options) => goto(url, { waitUntil: "domcontentloaded", ...options });
    page.reload = (options) => reload({ waitUntil: "domcontentloaded", ...options });
    await use(page);
  },
});

/** `test` for every Art spec; see the note above. */
export const testWithoutSignOut = base;

/**
 * `test` for specs that sign in themselves: whatever a spec signs in through the sign-in helper
 * is signed out through the account menu when the spec ends, so automated runs do not pile up
 * devices in the accounts they use.
 */
export const test = withSignOutAfterEach(base);

export { expect } from "@playwright/test";
