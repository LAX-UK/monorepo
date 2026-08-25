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

/**
 * One browser context per worker, seeded from the project storage state.
 * Sharing the live cookie jar prevents later tests from reloading a token
 * that Better Auth already rotated. Do not use this in specs that switch
 * `storageState` per describe.
 */
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
  context: async ({ workerContext, storageState }, use, testInfo) => {
    const recordTrace = Boolean(process.env.CI);
    if (recordTrace) {
      await workerContext.tracing.start({ screenshots: true, snapshots: true });
    }
    try {
      await use(workerContext);
    } finally {
      if (recordTrace) {
        const tracePath = testInfo.outputPath("trace.zip");
        await workerContext.tracing.stop({ path: tracePath });
        if (testInfo.status !== testInfo.expectedStatus) {
          await testInfo.attach("trace", { path: tracePath, contentType: "application/zip" });
        }
      }
      await persistContextAuthState(workerContext, storageState);
    }
  },
});

/**
 * Default Playwright context plus write-back of a still-valid session.
 * Use when a file switches `storageState` between describes.
 */
export const persistAuthTest = base.extend({
  page: async ({ page, storageState }, use) => {
    await use(page);
    await persistContextAuthState(page.context(), storageState);
  },
});

export { expect } from "@playwright/test";
