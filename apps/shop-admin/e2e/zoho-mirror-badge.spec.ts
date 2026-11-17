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
 * Z1–Z3). It opens an order in each state at a desk and on a phone: the fixture orders the CI stack
 * seeds (`pnpm --filter @auction/shop-api seed:zoho-mirror-badge`), and otherwise whatever orders
 * the environment holds, found with one batched status read. In CI a state with no order fails
 * the run rather than skipping, so the badge cannot pass the gate unopened. Literals rather than
 * imports, so the spec does not load the contracts package or shop-api.
 */
const BADGE_LABEL = {
  mirrored: "Mirrored to Zoho",
  pending: "Sending to Zoho",
  failed: "Not in Zoho",
  dry_run: "Zoho dry run",
} as const;
type BadgeState = keyof typeof BADGE_LABEL;

/** The seeded fixture orders (apps/shop-api/src/infrastructure/seed/zoho-mirror-badge-seed.ts). */
const FIXTURE_ORDERS = [
  "2a0e5d00-0000-4000-8000-000000000001",
  "2a0e5d00-0000-4000-8000-000000000002",
  "2a0e5d00-0000-4000-8000-000000000003",
  "2a0e5d00-0000-4000-8000-000000000004",
  "2a0e5d00-0000-4000-8000-000000000005",
];

/** A time as Z3 writes it: "16:10", or "14 Nov 2026, 16:02" (the LAX date style, no zone). */
const TIME = String.raw`(?:\d{1,2} [A-Z][a-z]{2} \d{4}, )?\d{2}:\d{2}`;

/** Z3's sentence that opens each state's details. */
const SENTENCE_START: Record<BadgeState, RegExp> = {
  mirrored: /^Last sent \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}\./,
  pending: new RegExp(
    String.raw`^Waiting to send the latest change\.( Tries again at ${TIME} \(attempt \d+\)\.)?$`,
  ),
  failed: /^Zoho refused the last change.*Staff in Failed jobs can fix and replay it\.$/,
  dry_run: /^LAX worked out what it would send and wrote nothing to Zoho\.$/,
};

/** Fail, in CI, where the fixtures are seeded; skip elsewhere, saying what is missing. */
function requireOrder(orderId: string | undefined, what: string): string {
  if (orderId) return orderId;
  if (process.env.CI) {
    throw new Error(`No order is "${what}": the CI stack must run seed:zoho-mirror-badge first.`);
  }
  test.skip(true, `No order in this environment is "${what}"`);
  return "";
}

type MirrorStatus = { id: string; state: BadgeState | "not_applicable" };

const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

/** One order id per state, from a single batched read of the fixtures and the first page of orders. */
async function ordersByState(page: Page): Promise<Map<MirrorStatus["state"], string>> {
  const found = new Map<MirrorStatus["state"], string>();
  const orders = await page.request.get("/api/admin/orders");
  const body = orders.ok()
    ? ((await orders.json()) as { items?: Array<{ orderId?: string }> })
    : { items: [] };
  const listed = (body.items ?? []).flatMap((item) => (item.orderId ? [item.orderId] : []));
  const ids = [...new Set([...FIXTURE_ORDERS, ...listed])].slice(0, 100);
  const statuses = await page.request.get(
    `/api/admin/zoho-mirror/statuses?entity=order&ids=${ids.join(",")}`,
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
        const orderId = requireOrder(byState.get(state), BADGE_LABEL[state]);
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
        // Focus moves to the details themselves for every state, whatever they hold (Z3).
        await expect(details).toBeFocused();
        // Each time in the sentence names its moment.
        for (const time of await details.locator("time").all()) {
          await expect(time).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
        }
        // Failed jobs only from a failure, and only where Bid says the person can open its Zoho rows.
        const failedJobs = details.getByRole("link", { name: /^Open in Failed jobs/ });
        if (state !== "failed") await expect(failedJobs).toHaveCount(0);
        else if ((await failedJobs.count()) > 0) {
          await expect(failedJobs).toHaveAttribute(
            "href",
            /\/admin\/failed-jobs\?source=integrations$/,
          );
        }
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
        await expect(sheet).toBeFocused();
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
      const orderId = requireOrder(byState.get("not_applicable"), "not mirrored");
      await session.page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(session.page, `/orders/${orderId}`);
      await expect(session.page.getByRole("button", { name: /^Zoho: / })).toHaveCount(0);
    });
  });
}
