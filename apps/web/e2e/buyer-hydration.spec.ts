import { type Page, expect, test } from "@playwright/test";
import { hydrationErrors } from "../src/test/e2e/hydration-errors";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { resolveLotRoutes, resolveSaleRoutes } from "./public-routes";

/**
 * The server and the browser must draw the same page. A mismatch (React error #418 and its
 * relatives) is an error in the console and fails the test, on a sale page, a lot page and the
 * client workspace. Console output is gathered from the first request until the page settles.
 */

/** Collects console errors and uncaught page errors; the returned function lists the hydration ones. */
function watchConsole(page: Page): () => string[] {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  page.on("pageerror", (error) => messages.push(error.message));
  return () => hydrationErrors(messages);
}

async function settle(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  // Hydration runs after the first paint; give late client components their turn.
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

test.describe("hydration @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("public sale and lot pages hydrate without a mismatch", async ({
    browser,
    baseURL,
    playwright,
  }) => {
    test.setTimeout(120_000);
    const request = await playwright.request.newContext();
    const routes = [...(await resolveSaleRoutes(request)), ...(await resolveLotRoutes(request))];
    await request.dispose();
    expect(routes.length, "the seeded stack has a sale and a lot to open").toBeGreaterThan(0);

    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        baseURL: baseURL ?? "http://localhost:3000",
        colorScheme: scheme,
        // A signed-out visitor, not the buyer this project is signed in as.
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      const failures = watchConsole(page);
      for (const route of routes) {
        await settle(page, route.path);
        expect(failures(), `${route.name} (${scheme}) hydrated cleanly`).toEqual([]);
      }
      await context.close();
    }
  });

  test("the client workspace hydrates without a mismatch", async ({ page }) => {
    test.setTimeout(120_000);
    const failures = watchConsole(page);
    for (const path of ["/home", "/purchases", "/bids", "/notifications"]) {
      await settle(page, path);
      expect(failures(), `${path} hydrated cleanly`).toEqual([]);
    }
  });
});
