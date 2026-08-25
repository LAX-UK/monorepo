import { type BrowserContext, test as base } from "@playwright/test";
import { persistContextAuthState, probePageSession } from "./auth";

type WorkerFixtures = {
  workerContext: BrowserContext;
};

function formatInvalidWorkerAuth(
  projectName: string,
  probe: Awaited<ReturnType<typeof probePageSession>>,
): string {
  return [
    `Project "${projectName}" started with an invalid auth state.`,
    `get-session=${probe.authStatus}`,
    `/users/me=${probe.meStatus}`,
    `cookies=${probe.cookieNames.join(",") || "(none)"}`,
  ].join(" ");
}

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
      if (process.env.PLAYWRIGHT_E2E === "1") {
        const page = await context.newPage();
        const probe = await probePageSession(page);
        await page.close();
        if (!probe.sessionAlive) {
          await context.close();
          throw new Error(formatInvalidWorkerAuth(workerInfo.project.name, probe));
        }
        if (storageState) {
          await persistContextAuthState(context, storageState);
        }
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
