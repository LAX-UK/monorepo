import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { type Locator, type Page, expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./support/axe.js";
import {
  type StaffAccount,
  type StaffSession,
  type StaffTheme,
  administratorAccount,
  closeStaffSession,
  e2eEnabled,
  openStaffPage,
  openStaffSession,
} from "./support/page-session.js";

/**
 * Leads › Release alerts, the release-alert send log (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, LA-3), against a real stack. The spec seeds its own data first: one published release
 * per status (`pnpm --filter @auction/shop-api seed:release-alert-sends`, insert-once, hermetic
 * local databases only). In CI a missing database, account or release fails the run; it never
 * skips. Literals rather than imports, so the spec does not load the contracts package or shop-api.
 */
const PATH = "/leads/release-alerts";

/** The seeded releases (apps/shop-api/src/infrastructure/seed/release-alert-sends-seed.ts). */
const FIXTURES = [
  { title: "Tidal study", status: "Sent", phone: "Emailed 3 of 4", notice: null },
  {
    title: "Night ferry",
    status: "Sending",
    phone: "Emailed 1 of 3",
    notice: "Each person gets it in their next daily email.",
  },
  {
    title: "Salt marsh",
    status: "Not sent yet",
    phone: "Emailed 0 of 1",
    notice: /still unsent more than a day after/,
  },
  {
    title: "Quiet harbour",
    status: "Not announced",
    phone: null,
    notice: "Publisher chose not to tell subscribers.",
  },
  {
    title: "First light",
    status: "Queued",
    phone: "Emailed 0 of 0",
    notice: /^The next alert run/,
  },
  {
    title: "Old pier",
    status: "Counts not kept",
    phone: "Emailed 2 of 2",
    notice: /^Details no longer kept in full/,
  },
] as const;

const ROLE_PASSWORD = process.env.LAX_ADMIN_ROLES_PASSWORD ?? "Password123!";
const rolesEnabled = process.env.LAX_ADMIN_ROLES_E2E === "1";
const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

/** In CI, where the gate must run, a missing prerequisite fails; elsewhere it skips, saying why. */
function prerequisite(ready: boolean, what: string) {
  if (ready) return;
  if (process.env.CI) throw new Error(`Release alerts e2e cannot run: ${what}`);
  test.skip(true, what);
}

/** Writes the fixture releases through the guarded seed; a second run changes nothing. */
function seedFixtures() {
  prerequisite(
    Boolean(process.env.DATABASE_URL),
    "DATABASE_URL (a hermetic local database) is needed to seed the fixture releases",
  );
  if (!process.env.DATABASE_URL) return;
  execFileSync("pnpm", ["--filter", "@auction/shop-api", "seed:release-alert-sends"], {
    cwd: join(import.meta.dirname, "..", "..", ".."),
    stdio: "inherit",
    env: process.env,
  });
}

const grid = (page: Page) => page.getByRole("grid", { name: "Release alerts" });
const rowOf = (page: Page, title: string): Locator =>
  grid(page).getByRole("row").filter({ hasText: title });
/** On a phone the table stacks into a list, one item per release. */
const phoneRowOf = (page: Page, title: string): Locator =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });

async function noSidewaysScroll(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

for (const theme of themes) {
  test.describe(`LAX Admin release alerts, ${theme} @a11y`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(180_000);

    let session: StaffSession | undefined;

    test.beforeAll(async ({ browser, baseURL }) => {
      prerequisite(e2eEnabled, "Set PLAYWRIGHT_E2E=1 against a running LAX Admin stack");
      prerequisite(account !== null && Boolean(baseURL), "administrator credentials are missing");
      if (!account || !baseURL) return;
      seedFixtures();
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

    test("the Release alerts tab on Leads lists each release with its status", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, "/leads");
      const tab = page.getByRole("link", { name: "Release alerts", exact: true });
      // History, not a queue: the tab carries no count (NAV-3).
      await expect(tab).toHaveText("Release alerts");
      await tab.click();
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Release alerts", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );

      for (const fixture of FIXTURES) {
        const row = rowOf(page, fixture.title);
        await expect(row, `${fixture.title} is listed`).toHaveCount(1);
        await expect(row.getByText(fixture.status, { exact: true })).toBeVisible();
        // Published in London time, in the LAX date style, with its instant.
        const time = row.locator("time").first();
        await expect(time).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
        await expect(time).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
      }
      await expect(rowOf(page, "Tidal study").getByText("by Ada Example")).toBeVisible();
      // Counts only: no address of anyone on the list appears.
      await expect(grid(page).getByText(/@example\.com/)).toHaveCount(0);
      await expectNoSeriousAxeViolations(page, PATH);
    });

    test("a row opens its release in a panel with its own address; Back closes it", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, PATH);
      for (const fixture of FIXTURES) {
        await rowOf(page, fixture.title).getByRole("link", { name: fixture.title }).click();
        const panel = page.getByRole("dialog", { name: new RegExp(fixture.title) });
        await expect(panel).toBeVisible();
        await expect(page).toHaveURL(/[?&]release=[0-9a-f-]{36}/);
        await expect(panel.getByText(fixture.status, { exact: true })).toBeVisible();
        if (fixture.notice) await expect(panel.getByText(fixture.notice)).toBeVisible();
        if (fixture.title === "Tidal study") {
          await expect(
            panel.getByText("1 person had turned off emails about new editions."),
          ).toBeVisible();
          await expect(panel.getByRole("link", { name: "Open artwork" })).toHaveAttribute(
            "href",
            /^\/artworks\/[0-9a-f-]{36}$/,
          );
          await expectNoSeriousAxeViolations(page, `${PATH} (release panel)`);
          // The panel's address reopens it.
          const address = page.url();
          await page.goBack();
          await expect(panel).toBeHidden();
          await page.goto(address);
          await expect(page.getByRole("dialog", { name: /Tidal study/ })).toBeVisible();
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      }
    });

    test("on a phone each row reads edition, status and Emailed N of M, with no sideways scroll", async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await page.setViewportSize({ width: 375, height: 812 });
      await openStaffPage(page, PATH);
      for (const fixture of FIXTURES) {
        const row = phoneRowOf(page, fixture.title);
        await expect(row.getByText(fixture.status, { exact: true })).toBeVisible();
        if (fixture.phone) await expect(row.getByText(fixture.phone)).toBeVisible();
        else await expect(row.getByText(/^Emailed /)).toHaveCount(0);
      }
      await noSidewaysScroll(page);
      await phoneRowOf(page, "Night ferry").getByRole("link", { name: "Night ferry" }).click();
      const panel = page.getByRole("dialog", { name: /Night ferry/ });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(370);
      await noSidewaysScroll(page);
    });
  });
}

/** Signs one of the demo top-up's single-role accounts in (scripts/ci/start-lax-admin-stack.sh). */
async function asRole(
  browser: Parameters<typeof openStaffSession>[0]["browser"],
  baseURL: string,
  email: string,
) {
  const role: StaffAccount = { email, password: ROLE_PASSWORD };
  return openStaffSession({
    browser,
    baseURL,
    account: role,
    theme: "light",
    viewport: { width: 1440, height: 1000 },
  });
}

test.describe("LAX Admin release alerts by role @roles", () => {
  test.setTimeout(120_000);

  test("operations cannot read leads: no tab, and the page says the role cannot open it", async ({
    browser,
    baseURL,
  }) => {
    prerequisite(e2eEnabled && rolesEnabled, "Set PLAYWRIGHT_E2E=1 and LAX_ADMIN_ROLES_E2E=1");
    if (!baseURL) throw new Error("baseURL is required");
    const session = await asRole(browser, baseURL, "lax-operations@lax.bid");
    try {
      const { page } = session;
      await page.goto(PATH, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Your role cannot open this page")).toBeVisible();
      await expect(page.getByRole("grid", { name: "Release alerts" })).toHaveCount(0);
      await expect(page.locator('[data-staff-shell] nav a[href="/leads"]')).toHaveCount(0);
    } finally {
      await closeStaffSession(session);
    }
  });

  test("an account manager reads the log but is not offered artworks it cannot open", async ({
    browser,
    baseURL,
  }) => {
    prerequisite(e2eEnabled && rolesEnabled, "Set PLAYWRIGHT_E2E=1 and LAX_ADMIN_ROLES_E2E=1");
    if (!baseURL) throw new Error("baseURL is required");
    seedFixtures();
    const session = await asRole(browser, baseURL, "lax-accounts@lax.bid");
    try {
      const { page } = session;
      await openStaffPage(page, "/leads");
      await page.getByRole("link", { name: "Release alerts", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      await rowOf(page, "Tidal study").getByRole("link", { name: "Tidal study" }).click();
      const panel = page.getByRole("dialog", { name: /Tidal study/ });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("link", { name: "Open artwork" })).toHaveCount(0);
    } finally {
      await closeStaffSession(session);
    }
  });
});
