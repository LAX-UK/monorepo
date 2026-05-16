import { expect, test } from "@playwright/test";

const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm build && pnpm start).";

function pathToSlug(path: string) {
  if (path === "/") return "home";
  return path.replace(/^\//, "").replace(/\//g, "-");
}

test.describe("marketing pages visual", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  for (const path of [
    "/",
    "/sales",
    "/archive",
    "/legal",
    "/privacy",
    "/terms",
    "/about",
    "/contact",
    "/artists",
  ]) {
    test(`${path} full-page screenshot`, async ({ page }) => {
      test.skip(!e2eEnabled || !visualEnabled, skipReason);
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("#main-content")).toBeVisible();

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });

      const slug = pathToSlug(path);
      await expect(page).toHaveScreenshot(`${slug}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
