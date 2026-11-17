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

/**
 * The "Mirrored to Zoho" badge on the order page (docs/design/staff-gaps-delivery-zoho-alerts.md,
 * Z1–Z3), against whatever orders the environment holds: one batched status read for a page of
 * orders finds an order in each state, and each state found is opened at a desk and on a phone.
 * Literals rather than imports, so the spec does not load the contracts package.
 */
const BADGE_LABEL = {
  mirrored: "Mirrored to Zoho",
  pending: "Sending to Zoho",
  failed: "Not in Zoho",
  dry_run: "Zoho dry run",
} as const;
type BadgeState = keyof typeof BADGE_LABEL;

/** Z3's sentence that opens each state's details. */
const SENTENCE_START: Record<BadgeState, RegExp> = {
  mirrored: /^Last sent /,
  pending: /^Waiting to send the latest change\./,
  failed: /^Zoho refused the last change.*Staff in Failed jobs can fix and replay it\.$/,
  dry_run: /^LAX worked out what it would send and wrote nothing to Zoho\.$/,
};

type MirrorStatus = { id: string; state: BadgeState | "not_applicable" };

const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

/** One order id per state, from a single batched read of the first page of orders. */
async function ordersByState(page: Page): Promise<Map<MirrorStatus["state"], string>> {
  const found = new Map<MirrorStatus["state"], string>();
  const orders = await page.request.get("/api/admin/orders");
  if (!orders.ok()) return found;
  const body = (await orders.json()) as { items?: Array<{ orderId?: string }> };
  const ids = (body.items ?? []).flatMap((item) => (item.orderId ? [item.orderId] : []));
  if (ids.length === 0) return found;
  const statuses = await page.request.get(
    `/api/admin/zoho-mirror/statuses?entity=order&ids=${ids.slice(0, 100).join(",")}`,
  );
  if (!statuses.ok()) return found;
  for (const status of ((await statuses.json()) as { items: MirrorStatus[] }).items) {
    if (!found.has(status.state)) found.set(status.state, status.id);
  }
  return found;
}

function badgeName(state: BadgeState): string {
  return `Zoho: ${BADGE_LABEL[state]}, details`;
}

for (const theme of themes) {
  test.describe(`LAX Admin order page, Zoho badge, ${theme} @a11y`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(180_000);
    test.skip(
      !e2eEnabled || !account,
      "Set PLAYWRIGHT_E2E=1 and administrator credentials (SHOP_ADMIN_ACCEPTANCE_* or PLAYWRIGHT_STAFF_*).",
    );

    let session: StaffSession | undefined;
    let byState = new Map<MirrorStatus["state"], string>();

    test.beforeAll(async ({ browser, baseURL }) => {
      if (!account || !baseURL) return;
      session = await openStaffSession({
        browser,
        baseURL,
        account,
        theme,
        viewport: { width: 1440, height: 1000 },
      });
      byState = await ordersByState(session.page);
    });

    test.afterAll(async () => {
      if (session) await closeStaffSession(session);
    });

    for (const state of Object.keys(BADGE_LABEL) as BadgeState[]) {
      test(`${BADGE_LABEL[state]}: a button in the header that opens its details`, async () => {
        if (!session) throw new Error("Not signed in");
        const orderId = byState.get(state);
        test.skip(!orderId, `No order in this environment is "${BADGE_LABEL[state]}"`);
        const { page } = session;

        // A desk: a popover beside the badge.
        await page.setViewportSize({ width: 1440, height: 1000 });
        await openStaffPage(page, `/orders/${orderId}`);
        const header = page
          .locator("header")
          .filter({ has: page.getByRole("heading", { level: 1 }) });
        const badge = header.getByRole("button", { name: badgeName(state), exact: true });
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText(BADGE_LABEL[state]);
        await badge.focus();
        await page.keyboard.press("Enter");
        const details = page.getByRole("dialog", { name: BADGE_LABEL[state] });
        await expect(details).toBeVisible();
        await expect(details.getByRole("heading", { name: BADGE_LABEL[state] })).toBeVisible();
        await expect(details.locator("p").first()).toHaveText(SENTENCE_START[state]);
        await expect(details.locator(":focus")).toHaveCount(1);
        await expectNoSeriousAxeViolations(page, `/orders/${orderId} (Zoho details)`);
        await page.keyboard.press("Escape");
        await expect(details).toBeHidden();
        await expect(badge).toBeFocused();

        // A phone: the same details in a bottom sheet with a 44px close.
        await page.setViewportSize({ width: 375, height: 812 });
        await openStaffPage(page, `/orders/${orderId}`);
        const phoneBadge = page.getByRole("button", { name: badgeName(state), exact: true });
        await phoneBadge.click();
        const sheet = page.getByRole("dialog", { name: BADGE_LABEL[state] });
        await expect(sheet).toBeVisible();
        await expect(sheet).toHaveAttribute("data-side", "bottom");
        const close = sheet.getByRole("button", { name: "Close" });
        const box = await close.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(width).toBeLessThanOrEqual(375);
        await close.click();
        await expect(sheet).toBeHidden();
        await expect(phoneBadge).toBeFocused();
      });
    }

    test("an order with nothing to mirror has no Zoho badge", async () => {
      if (!session) throw new Error("Not signed in");
      const orderId = byState.get("not_applicable");
      test.skip(!orderId, "No order in this environment is not mirrored");
      await session.page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(session.page, `/orders/${orderId}`);
      await expect(session.page.getByRole("button", { name: /^Zoho: / })).toHaveCount(0);
    });
  });
}
