import { type BrowserContext, test as base } from "@playwright/test";
import { formatPageSessionFailure, probePageSession } from "./auth";

const BID_SESSION_COOKIE = /(?:__Host-)?lax-bid-session/;

async function assertPreparedBidSession(context: BrowserContext, label: string): Promise<void> {
  if (process.env.PLAYWRIGHT_E2E !== "1" || process.env.PLAYWRIGHT_AUTH_PREPARED !== "1") return;
  const cookies = (await context.storageState()).cookies;
  if (!cookies.some((cookie) => BID_SESSION_COOKIE.test(cookie.name))) {
    throw new Error(`Storage state missing lax-bid-session (${label})`);
  }
}

/** Fresh Playwright context per test; prepared `.auth` files are read-only inputs. */
export const test = base.extend({
  page: async ({ page, storageState }, use) => {
    if (typeof storageState === "string") {
      await assertPreparedBidSession(page.context(), storageState);
      const probe = await probePageSession(page);
      if (!probe.authenticated) {
        throw new Error(formatPageSessionFailure(storageState, probe, page.url()));
      }
    }
    await use(page);
  },
});

export { expect } from "@playwright/test";
