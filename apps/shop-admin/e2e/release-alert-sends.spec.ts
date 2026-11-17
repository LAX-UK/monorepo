import { type Locator, type Page, expect, test } from "@playwright/test";
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
  RELEASE_ALERTS_PATH,
  releaseAlertPrerequisite,
  seedReleaseAlertFixtures,
} from "./support/release-alert-fixtures.js";

/**
 * Leads › Release alerts, the release-alert send log (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, LA-3), against a real stack. The spec seeds its own data first: one published release
 * per status (`pnpm --filter @auction/shop-api seed:release-alert-sends`, insert-once, hermetic
 * local databases only). In CI a missing database, account or release fails the run; it never
 * skips. Literals rather than imports, so the spec does not load the contracts package or shop-api.
 *
 * The account manager's view (reads the log, no artwork link) is checked in `staff-roles.spec.ts`,
 * inside the session that spec already opens for that role, so it costs no sign-in of its own.
 */
const PATH = RELEASE_ALERTS_PATH;

/** The Sending fixture's long title (`RELEASE_ALERT_LONG_FIXTURE_TITLE` in the seed). */
const LONG_TITLE =
  "Night ferry, crossing at low tide after Whistler: second state, signed proof with the artist's annotations";

/** The seeded releases (apps/shop-api/src/infrastructure/seed/release-alert-sends-seed.ts). */
const FIXTURES = [
  { title: "Tidal study", status: "Sent", phone: "Emailed 3 of 4", notice: null },
  {
    title: LONG_TITLE,
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
    // Not worked out yet: the badge speaks, never "Emailed 0 of 0".
    phone: null,
    notice: /^The next alert run/,
  },
  {
    title: "Old pier",
    status: "Counts not kept",
    phone: "Emailed 2 of 2",
    notice: /^Details no longer kept in full/,
  },
] as const;

const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

const grid = (page: Page) => page.getByRole("grid", { name: "Release alerts" });
const rowOf = (page: Page, title: string): Locator =>
  grid(page).getByRole("row").filter({ hasText: title });
/** On a phone the table stacks into a list, one item per release. */
const phoneRowOf = (page: Page, title: string): Locator =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function noSidewaysScroll(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

/** The staff theme is a cookie the server reads, so one signed-in session can show both themes. */
const THEME_COOKIE = "lax_staff_theme";

async function useTheme(session: StaffSession, theme: StaffTheme) {
  await session.context.addCookies([{ name: THEME_COOKIE, value: theme, url: session.baseURL }]);
}

/*
 * One administrator session for both themes: every sign-in counts against the identity service's
 * per-address limit, which the other LAX Admin checks in the same run share.
 */
test.describe("LAX Admin release alerts @a11y", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  let session: StaffSession | undefined;

  test.beforeAll(async ({ browser, baseURL }) => {
    releaseAlertPrerequisite(e2eEnabled, "Set PLAYWRIGHT_E2E=1 against a running LAX Admin stack");
    releaseAlertPrerequisite(
      account !== null && Boolean(baseURL),
      "administrator credentials are missing",
    );
    if (!account || !baseURL) return;
    seedReleaseAlertFixtures();
    session = await openStaffSession({
      browser,
      baseURL,
      account,
      theme: "light",
      viewport: { width: 1440, height: 1000 },
    });
  });

  test.afterAll(async () => {
    if (session) await closeStaffSession(session);
  });

  for (const theme of themes) {
    test(`${theme}: the Release alerts tab on Leads lists each release with its status`, async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await useTheme(session, theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, "/leads");
      await expect(page.locator("html")).toHaveAttribute("data-staff-theme", theme);
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
      // TBL-8 and TBL-13: every column, the 56px … last, fits the card at 1440 with no scroll.
      const fits = await grid(page).evaluate((table) => {
        const wrapper = table.parentElement as HTMLElement;
        return { scroll: wrapper.scrollWidth, client: wrapper.clientWidth };
      });
      expect(fits.scroll).toBeLessThanOrEqual(fits.client);
      const menu = rowOf(page, "Tidal study").getByRole("button", {
        name: "Actions for Tidal study",
      });
      await expect(menu).toBeInViewport({ ratio: 1 });
      // A long title is cut short on its row, and stays whole for screen readers and on hover.
      const long = rowOf(page, LONG_TITLE).getByRole("link", { name: LONG_TITLE, exact: true });
      await expect(long).toBeVisible();
      expect(await long.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      const rowHeights = await grid(page)
        .getByRole("row")
        .evaluateAll((rows) => rows.slice(1).map((row) => row.getBoundingClientRect().height));
      expect(new Set(rowHeights).size, "every row keeps one height").toBe(1);
      // Counts only: no address of anyone on the list appears.
      await expect(grid(page).getByText(/@example\.com/)).toHaveCount(0);
      await expectNoSeriousAxeViolations(page, PATH);
    });

    test(`${theme}: a row opens its release in a panel with its own address; Back closes it`, async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await useTheme(session, theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openStaffPage(page, PATH);
      for (const fixture of FIXTURES) {
        await rowOf(page, fixture.title)
          .getByRole("link", { name: fixture.title, exact: true })
          .click();
        const panel = page.getByRole("dialog", { name: new RegExp(escapeRegExp(fixture.title)) });
        await expect(panel).toBeVisible();
        await expect(page).toHaveURL(/[?&]release=[0-9a-f-]{36}/);
        await expect(panel.getByText(fixture.status, { exact: true })).toBeVisible();
        if (fixture.notice) await expect(panel.getByText(fixture.notice)).toBeVisible();
        if (fixture.title === LONG_TITLE) {
          // The long title wraps in the header; the place and ↑ ↓ stay on screen.
          await expect(panel.getByRole("heading", { name: LONG_TITLE })).toBeVisible();
          await expect(panel.getByRole("button", { name: "Next release" })).toBeInViewport();
          await expect(panel.getByRole("link", { name: "Open artwork" })).toBeInViewport();
        }
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

    test(`${theme}: on a phone each row reads edition, status and Emailed N of M, with no sideways scroll`, async () => {
      if (!session) throw new Error("Not signed in");
      const { page } = session;
      await useTheme(session, theme);
      await page.setViewportSize({ width: 375, height: 812 });
      await openStaffPage(page, PATH);
      for (const fixture of FIXTURES) {
        const row = phoneRowOf(page, fixture.title);
        await expect(row.getByText(fixture.status, { exact: true })).toBeVisible();
        if (fixture.phone) await expect(row.getByText(fixture.phone)).toBeVisible();
        else await expect(row.getByText(/^Emailed /)).toHaveCount(0);
      }
      await noSidewaysScroll(page);
      // The long title is cut short, so the badge and the … keep their places on the row.
      const longRow = phoneRowOf(page, LONG_TITLE);
      const rowBox = await longRow.boundingBox();
      const badgeBox = await longRow.getByText("Sending", { exact: true }).boundingBox();
      expect(badgeBox && rowBox && badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
        (rowBox?.x ?? 0) + (rowBox?.width ?? 0),
      );
      await longRow.getByRole("link", { name: LONG_TITLE, exact: true }).click();
      const panel = page.getByRole("dialog", { name: new RegExp(escapeRegExp(LONG_TITLE)) });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(370);
      await expect(panel.getByRole("link", { name: "Open artwork" })).toBeInViewport();
      await noSidewaysScroll(page);
    });
  }

  test("a panel link to a release on another page opens it; one naming no release says so", async () => {
    if (!session) throw new Error("Not signed in");
    const { page } = session;
    await useTheme(session, "light");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openStaffPage(page, PATH);
    const row = rowOf(page, "Tidal study");
    const published = await row.locator("time").first().getAttribute("datetime");
    await row.getByRole("link", { name: "Tidal study", exact: true }).click();
    const id = new URL(page.url()).searchParams.get("release");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await page.keyboard.press("Escape");
    // The page that starts just after Tidal study (the read's own cursor shape): the release is
    // not on it, as for a link shared from the first page once newer releases have pushed it on.
    const cursor = Buffer.from(JSON.stringify({ createdAt: published, id })).toString("base64url");
    await openStaffPage(page, `${PATH}?cursor=${cursor}&release=${id}`);
    // Whatever else the stack holds, the rows shown are all older than Tidal study.
    await expect(rowOf(page, "Tidal study")).toHaveCount(0);
    const panel = page.getByRole("dialog", { name: /Tidal study/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Sent", { exact: true })).toBeVisible();
    await expect(
      panel.getByText("1 person had turned off emails about new editions."),
    ).toBeVisible();
    // Not among the rows shown, so there is no place to step from.
    await expect(panel.getByRole("button", { name: "Next release" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A link naming no release opens a panel that says so, rather than nothing.
    await page.goto(`${PATH}?release=00000000-0000-4000-8000-000000000000`);
    const missing = page.getByRole("dialog", { name: "Release alert not found" });
    await expect(missing).toBeVisible();
    await expect(
      missing.getByText(/No published edition in the log matches this link/),
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page, `${PATH} (release not found)`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  });
});
