import { type BrowserContext, test as base } from "@playwright/test";
import { persistContextAuthState } from "./auth";

const BID_SESSION_COOKIE = /(?:__Host-)?lax-bid-session/;

type WorkerFixtures = {
  contextsByStorageState: Map<string, BrowserContext>;
};

async function assertPreparedBidSession(context: BrowserContext, label: string): Promise<void> {
  if (process.env.PLAYWRIGHT_E2E !== "1") return;
  const cookies = (await context.storageState()).cookies;
  if (!cookies.some((cookie) => BID_SESSION_COOKIE.test(cookie.name))) {
    throw new Error(`Storage state missing lax-bid-session (${label})`);
  }
}

/** Reuses one cookie jar per worker and storage-state file so BFF sessions stay live. */
export const test = base.extend<object, WorkerFixtures>({
  contextsByStorageState: [
    async (_fixtures, use) => {
      const contexts = new Map<string, BrowserContext>();
      await use(contexts);
      await Promise.all([...contexts.values()].map((context) => context.close()));
    },
    { scope: "worker" },
  ],
  context: async ({ browser, storageState, contextsByStorageState }, use, testInfo) => {
    const projectUse = testInfo.project.use;
    const options = {
      viewport: projectUse.viewport ?? { width: 1280, height: 800 },
      deviceScaleFactor: projectUse.deviceScaleFactor ?? 1,
      ...(projectUse.baseURL ? { baseURL: projectUse.baseURL } : {}),
    };
    const statePath = typeof storageState === "string" ? storageState : undefined;

    if (!statePath) {
      const ephemeral = await browser.newContext(options);
      await use(ephemeral);
      await ephemeral.close();
      return;
    }

    let context = contextsByStorageState.get(statePath);
    if (!context) {
      context = await browser.newContext({ ...options, storageState: statePath });
      await assertPreparedBidSession(context, statePath);
      contextsByStorageState.set(statePath, context);
    }

    await use(context);
    await persistContextAuthState(context, statePath);
  },
});

/** Per-test context that writes a still-valid session back after each describe. */
export const persistAuthTest = test.extend({
  page: async ({ page, storageState }, use) => {
    await use(page);
    await persistContextAuthState(page.context(), storageState);
  },
});

export { expect } from "@playwright/test";
