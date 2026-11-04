import { type Locator, type Page, expect, test } from "@playwright/test";
import { administratorStaffPages } from "./support/lax-admin-pages.js";
import {
  type StaffSession,
  type StaffTheme,
  administratorAccount,
  e2eEnabled,
  openStaffPage,
  openStaffSession,
  resolveStaffPath,
} from "./support/page-session.js";

const account = administratorAccount();
const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";

const variants = [
  { id: "desktop-light", theme: "light", viewport: { width: 1440, height: 1000 } },
  { id: "desktop-dark", theme: "dark", viewport: { width: 1440, height: 1000 } },
  { id: "mobile-light", theme: "light", viewport: { width: 375, height: 812 } },
] as const satisfies ReadonlyArray<{
  id: string;
  theme: StaffTheme;
  viewport: { width: number; height: number };
}>;

/** What changes between runs or between seeds: dates, avatars, pictures and the nav counts. */
function dynamicContent(page: Page): Locator[] {
  return [
    page.locator("time"),
    page.locator('[data-slot="avatar"]'),
    page.locator("img"),
    // Waiting counts beside nav labels are the only nav links with screen-reader count text.
    page.locator("nav a:has(.sr-only)"),
  ];
}

for (const variant of variants) {
  test.describe(`LAX Admin pages, ${variant.id} @visual`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(120_000);
    test.skip(
      !e2eEnabled || !visualEnabled || !account,
      "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1 and administrator credentials.",
    );

    let session: StaffSession | undefined;

    test.beforeAll(async ({ browser, baseURL }) => {
      if (!account || !baseURL) return;
      session = await openStaffSession({
        browser,
        baseURL,
        account,
        theme: variant.theme,
        viewport: variant.viewport,
      });
    });

    test.afterAll(async () => {
      await session?.context.close();
    });

    for (const staffPage of administratorStaffPages()) {
      test(staffPage.slug, async () => {
        if (!session) throw new Error("Not signed in");
        const { page } = session;
        const path = await resolveStaffPath(page, staffPage.path);
        test.skip(path === null, "No artwork in this environment to open the editor on");
        if (path === null) return;
        await openStaffPage(page, path);
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
        });
        await expect(page).toHaveScreenshot(`${staffPage.slug}-${variant.id}.png`, {
          fullPage: true,
          mask: dynamicContent(page),
        });
      });
    }
  });
}
