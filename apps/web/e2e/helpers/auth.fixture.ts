import { type BrowserContext, test as base } from "@playwright/test";
import { persistContextAuthState } from "./auth";

type WorkerFixtures = {
  workerContext: BrowserContext;
};

/** Reuses one cookie jar per worker so rotated Better Auth tokens stay live. */
export const test = base.extend<object, WorkerFixtures>({
  workerContext: [
    async ({ browser }, use, workerInfo) => {
      const projectUse = workerInfo.project.use;
      const storageState =
        typeof projectUse.storageState === "string" ? projectUse.storageState : undefined;
      const context = await browser.newContext({
        viewport: projectUse.viewport ?? { width: 1280, height: 800 },
        deviceScaleFactor: projectUse.deviceScaleFactor ?? 1,
        ...(projectUse.baseURL ? { baseURL: projectUse.baseURL } : {}),
        ...(storageState ? { storageState } : {}),
      });
      const cookies = (await context.storageState()).cookies;
      if (
        process.env.PLAYWRIGHT_E2E === "1" &&
        !cookies.some((cookie) => cookie.name.includes("session_token"))
      ) {
        await context.close();
        throw new Error(`Project "${workerInfo.project.name}" storage state has no session_token`);
      }
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  context: async ({ workerContext, storageState }, use) => {
    await use(workerContext);
    await persistContextAuthState(workerContext, storageState);
  },
});

/** Per-test context that writes a still-valid session back after each describe. */
export const persistAuthTest = base.extend({
  page: async ({ page, storageState }, use) => {
    await use(page);
    await persistContextAuthState(page.context(), storageState);
  },
});

export { expect } from "@playwright/test";
