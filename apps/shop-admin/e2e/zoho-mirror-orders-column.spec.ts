import { type Page, expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./support/axe.js";
import {
  type StaffSession,
  type StaffTheme,
  administratorAccount,
  closeStaffSession,
  e2eEnabled,
  openStaffPage,
  openStaffSession,
} from "./support/page-session.js";
import {
  BADGE_LABEL,
  BADGE_STATES,
  FIXTURE_ORDERS,
  type MirrorState,
  recordsByState,
  requireFixture,
} from "./support/zoho-mirror.js";

/**
 * The Orders list's optional "Zoho" column (docs/design/staff-gaps-delivery-zoho-alerts.md, Z1):
 * hidden by default, shown from Display and remembered (TBL-12), each order's badge as on its
 * page and nothing for an order with nothing to mirror. Opened on the day the CI stack's fixture
 * orders were placed (`seed:zoho-mirror-badge`), so every state is on the page; in CI a missing
 * state fails rather than skips.
 */
const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];
const COLUMNS_KEY = "staff.columns.orders";

/** The London day an order was placed, as the list's created filter takes it. */
async function placedOn(page: Page, orderId: string): Promise<string | null> {
  const response = await page.request.get(`/api/admin/orders/${orderId}`);
  if (!response.ok()) return null;
  const { createdAt } = (await response.json()) as { createdAt: string };
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(createdAt),
  );
}

function orderRow(page: Page, orderId: string) {
  return page
    .getByRole("grid")
    .locator("tr")
    .filter({ has: page.locator(`a[href^="/orders/${orderId}"]`) });
}

for (const theme of themes) {
  test.describe(`LAX Admin Orders list, Zoho column, ${theme} @a11y`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(180_000);
    test.skip(
      !e2eEnabled || !account,
      "Set PLAYWRIGHT_E2E=1 and administrator credentials (SHOP_ADMIN_ACCEPTANCE_* or PLAYWRIGHT_STAFF_*).",
    );

    let session: StaffSession | undefined;
    let byState = new Map<MirrorState, string>();
    let listPath = "/orders";

    test.beforeAll(async ({ browser, baseURL }) => {
      if (!account || !baseURL) return;
      session = await openStaffSession({
        browser,
        baseURL,
        account,
        theme,
        viewport: { width: 1440, height: 1000 },
      });
      byState = await recordsByState(session.page, "order", FIXTURE_ORDERS);
      const anyFixture = byState.get("mirrored");
      const day = anyFixture ? await placedOn(session.page, anyFixture) : null;
      if (day) listPath = `/orders?from=${day}&to=${day}&limit=100`;
    });

    test.afterAll(async () => {
      if (session) await closeStaffSession(session);
    });

    test("is hidden by default, shown from Display, and stays shown on reload", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, listPath);
      await page.evaluate((key) => window.localStorage.removeItem(key), COLUMNS_KEY);
      await page.reload();
      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible();
      await expect(grid.getByRole("columnheader", { name: "Zoho" })).toHaveCount(0);

      const display = page.getByRole("button", { name: /^Display/ });
      await display.focus();
      await page.keyboard.press("Enter");
      const zoho = page.getByRole("menuitemcheckbox", { name: "Zoho" });
      await expect(zoho).toHaveAttribute("aria-checked", "false");
      await zoho.focus();
      await page.keyboard.press("Space");
      await expect(zoho).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("Escape");
      await expect(grid.getByRole("columnheader", { name: "Zoho" })).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole("grid").getByRole("columnheader", { name: "Zoho" }),
      ).toBeVisible();
    });

    test("shows each order's badge as on its page, and nothing for one with nothing to mirror", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, listPath);
      for (const state of BADGE_STATES) {
        const orderId = requireFixture(byState.get(state), `order: ${BADGE_LABEL[state]}`);
        const badge = orderRow(page, orderId).locator(`[data-zoho-mirror="${state}"]`);
        await expect(badge).toHaveText(BADGE_LABEL[state]);
      }
      const unsent = requireFixture(byState.get("not_applicable"), "order: not mirrored");
      await expect(orderRow(page, unsent).locator("[data-zoho-mirror]")).toHaveCount(0);
      await expectNoSeriousAxeViolations(page, `${listPath} (Zoho column)`);
    });

    test("on a phone, the badge has a line of its own under the order, with no sideways scroll", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 375, height: 812 });
      await openStaffPage(page, listPath);
      const mirrored = requireFixture(byState.get("mirrored"), "order: Mirrored to Zoho");
      const card = page
        .locator(`a[href^="/orders/${mirrored}"]`)
        .filter({ visible: true })
        .first()
        .locator("xpath=ancestor::li[1]");
      await expect(card.locator('[data-zoho-mirror="mirrored"]')).toBeVisible();
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(375);
    });
  });
}
