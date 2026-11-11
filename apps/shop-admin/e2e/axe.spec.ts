import { type Page, test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./support/axe.js";
import { administratorStaffPages } from "./support/lax-admin-pages.js";
import {
  type StaffSession,
  type StaffTheme,
  administratorAccount,
  closeStaffSession,
  e2eEnabled,
  openStaffPage,
  openStaffSession,
  resolveStaffPath,
} from "./support/page-session.js";

const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

async function checkPage(page: Page, path: string): Promise<void> {
  const resolved = await resolveStaffPath(page, path);
  test.skip(resolved === null, "No artwork in this environment to open the editor on");
  if (resolved === null) return;
  await openStaffPage(page, resolved);
  await expectNoSeriousAxeViolations(page, path);
}

for (const theme of themes) {
  test.describe(`LAX Admin accessibility, ${theme} @a11y`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(120_000);
    test.skip(
      !e2eEnabled || !account,
      "Set PLAYWRIGHT_E2E=1 and administrator credentials (SHOP_ADMIN_ACCEPTANCE_* or PLAYWRIGHT_STAFF_*).",
    );

    let session: StaffSession | undefined;

    test.beforeAll(async ({ browser, baseURL }) => {
      if (!account || !baseURL) return;
      session = await openStaffSession({
        browser,
        baseURL,
        account,
        theme,
        viewport: { width: 1440, height: 1000 },
      });
    });

    test.afterAll(async () => {
      if (session) await closeStaffSession(session);
    });

    for (const staffPage of administratorStaffPages()) {
      test(`${staffPage.label} has no serious axe violations`, async () => {
        if (!session) throw new Error("Not signed in");
        await checkPage(session.page, staffPage.path);
      });
    }
  });
}
