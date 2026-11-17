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

/*
 * Stock location in LAX Admin (docs/design/stock-location.md) against the running stack: an
 * Administrator keeps the list (add, rename, retire, restore), moves an artwork from its record and
 * a selection from All artworks, and the pages pass axe in both themes; the Locations tab fits a
 * 375px phone; a read-only role sees the list and the record with nothing to change or move; a
 * Catalogue editor is offered Move and an account manager is not (owner decision, 17 Nov 2026:
 * only Catalogue editors and Administrators move artworks).
 *
 * The moves use the fixture artworks and location the CI stack seeds
 * (`pnpm --filter @auction/shop-api seed:stock-location`). In CI a missing fixture fails the run
 * rather than skipping, so the move flow cannot pass the gate unrun. Literals rather than imports,
 * so the spec does not load shop-api.
 */

const LOCATIONS_PATH = "/from-zoho?tab=locations";
const account = administratorAccount();
const rolesEnabled = process.env.LAX_ADMIN_ROLES_E2E === "1";
const password = process.env.LAX_ADMIN_ROLES_PASSWORD ?? "Password123!";

/** The seeded fixtures (apps/shop-api/src/infrastructure/seed/stock-location-e2e-seed.ts). */
const FIXTURE_LOCATION = "E2E stock room";
const FIXTURE_LIST_PATH = "/from-zoho?tab=all&artist=ZLOC";
const FIXTURE = {
  firstMove: "Location fixture: first move",
  toMove: "Location fixture: to move",
  alreadyThere: "Location fixture: already there",
} as const;
const MOVE_NOTE = "Hung for the e2e check";

/**
 * The seed runs once per stack, so a retried test finds the moves its first try made: the first
 * try checks the exact outcome, a retry also accepts "already there".
 */
const firstTry = () => test.info().retry === 0;

/** The fixtures' All artworks rows; fail in CI, where they are seeded, and skip elsewhere. */
async function openFixtureList(page: Page) {
  await openStaffPage(page, FIXTURE_LIST_PATH);
  const row = rowOf(page, FIXTURE.alreadyThere);
  await row
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => undefined);
  if ((await row.count()) > 0) return;
  if (process.env.CI) {
    throw new Error(
      "The stock location fixture artworks are missing: the CI stack must run seed:stock-location first.",
    );
  }
  test.skip(true, "No stock location fixture artworks here (run seed:stock-location).");
}

/** Opens a fixture artwork's From Zoho record from All artworks; returns its path. */
async function openFixtureRecord(page: Page, title: string): Promise<string> {
  await openFixtureList(page);
  await rowOf(page, title).getByText(title, { exact: true }).click();
  await page.waitForURL(/\/from-zoho\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return new URL(page.url()).pathname;
}

/** The record's Location panel: the section headed "Location" (not "Where it is"). */
const locationPanel = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Location", exact: true }) });
/** The panel's "Now at" value: the first entry of its key-value list. */
const nowAt = (page: Page) => locationPanel(page).locator("dd").first();

async function chooseFixtureLocation(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(`^${FIXTURE_LOCATION}`) }).click();
}

async function openLocations(page: Page) {
  await openStaffPage(page, LOCATIONS_PATH);
  await expect(page.getByRole("link", { name: "Locations" })).toHaveAttribute(
    "aria-current",
    "page",
  );
}

const rowOf = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

test.describe("LAX Admin stock locations @a11y", () => {
  test.setTimeout(120_000);
  test.skip(
    !e2eEnabled || !account,
    "Set PLAYWRIGHT_E2E=1 and administrator credentials (SHOP_ADMIN_ACCEPTANCE_* or PLAYWRIGHT_STAFF_*).",
  );

  async function session(
    browser: Parameters<typeof openStaffSession>[0]["browser"],
    baseURL: string | undefined,
    theme: StaffTheme,
    viewport = { width: 1440, height: 1000 },
  ): Promise<StaffSession> {
    if (!account || !baseURL) throw new Error("Not configured");
    return openStaffSession({ browser, baseURL, account, theme, viewport });
  }

  test("an Administrator adds, renames, retires and restores a location", async ({
    browser,
    baseURL,
  }) => {
    const opened = await session(browser, baseURL, "light");
    try {
      const { page } = opened;
      await openLocations(page);
      const name = `Store room ${Date.now().toString(36)}`;

      await page.getByRole("button", { name: "Add location" }).first().click();
      const add = page.getByRole("dialog", { name: "Add location" });
      // Nothing typed: the summary and the field both say what is missing.
      await add.getByRole("button", { name: "Add location" }).click();
      await expect(add.getByText("Name: Give the location a name.")).toBeVisible();
      await add.getByLabel(/^Name/).fill(name);
      await add.getByLabel(/^Note/).fill("By the loading bay");
      await add.getByRole("button", { name: "Add location" }).click();
      await expect(add).toBeHidden();
      await expect(rowOf(page, name)).toContainText("Active");

      // A second location with the same name, in another case, is refused beside the field.
      await page.getByRole("button", { name: "Add location" }).first().click();
      const again = page.getByRole("dialog", { name: "Add location" });
      await again.getByLabel(/^Name/).fill(name.toUpperCase());
      await again.getByRole("button", { name: "Add location" }).click();
      await expect(again.getByText("Name: Another location already has this name.")).toBeVisible();
      await again.getByRole("button", { name: "Cancel" }).click();

      await rowOf(page, name).getByText(name).click();
      const edit = page.getByRole("dialog", { name: `Edit ${name}` });
      await edit.getByLabel(/^Name/).fill(`${name} B`);
      await edit.getByRole("button", { name: "Save location" }).click();
      await expect(edit).toBeHidden();
      await expect(rowOf(page, `${name} B`)).toBeVisible();

      await rowOf(page, `${name} B`)
        .getByRole("button", { name: /Actions for/ })
        .click();
      await page.getByRole("menuitem", { name: "Retire…" }).click();
      await page.getByRole("button", { name: "Retire location" }).click();
      await expect(rowOf(page, `${name} B`)).toContainText("Retired");

      await rowOf(page, `${name} B`)
        .getByRole("button", { name: /Actions for/ })
        .click();
      await page.getByRole("menuitem", { name: "Restore…" }).click();
      await page.getByRole("button", { name: "Restore location" }).click();
      await expect(rowOf(page, `${name} B`)).toContainText("Active");
    } finally {
      await closeStaffSession(opened);
    }
  });

  test("an Administrator moves an artwork from its record, then a selection from All artworks", async ({
    browser,
    baseURL,
  }) => {
    const opened = await session(browser, baseURL, "light");
    try {
      const { page } = opened;
      await openFixtureRecord(page, FIXTURE.firstMove);
      const panel = locationPanel(page);
      if (firstTry()) {
        await expect(nowAt(page)).toHaveText("Location not recorded");
        await expect(panel.getByText("No moves recorded yet.")).toBeVisible();
      }

      await panel.getByRole("button", { name: "Move…" }).click();
      const dialog = page.getByRole("dialog", { name: `Move ${FIXTURE.firstMove}` });
      // Nothing chosen: the summary and the field both say so.
      await dialog.getByRole("button", { name: "Move artwork" }).click();
      await expect(dialog.getByText("Move to: Choose where the artwork is going.")).toBeVisible();
      await chooseFixtureLocation(page, dialog);
      await dialog.getByLabel(/^Note/).fill(MOVE_NOTE);
      await dialog.getByRole("button", { name: "Move artwork" }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByText(
          firstTry()
            ? `Moved to ${FIXTURE_LOCATION}`
            : new RegExp(`^(Moved to|Already at) ${FIXTURE_LOCATION}$`),
        ),
      ).toBeVisible();

      await expect(nowAt(page)).toHaveText(FIXTURE_LOCATION);
      const moves = panel.getByRole("list", { name: "Location history" });
      await expect(moves).toContainText(`First recorded at ${FIXTURE_LOCATION}`);
      await expect(moves).toContainText(MOVE_NOTE);
      // The record's own history has the move too.
      await expect(page.getByRole("list", { name: "Artwork history" })).toContainText(
        "Location changed",
      );

      // Then a selection from All artworks, in the same sign-in: the sign-in service limits auth
      // calls per minute, and the gate signs in many times already.
      await openFixtureList(page);
      await rowOf(page, FIXTURE.toMove).getByRole("checkbox").check();
      await rowOf(page, FIXTURE.alreadyThere).getByRole("checkbox").check();
      await page.getByRole("button", { name: "Move selected…" }).click();

      const many = page.getByRole("dialog", { name: "Move 2 artworks" });
      await chooseFixtureLocation(page, many);
      await many.getByLabel(/^Note/).fill("Winter hang");
      await many.getByRole("button", { name: "Move 2 artworks" }).click();
      await expect(many).toBeHidden();
      // The seed already moved one of them there.
      await expect(
        page.getByText(
          firstTry()
            ? `1 artwork moved to ${FIXTURE_LOCATION}; 1 artwork already there`
            : new RegExp(
                `^(1 artwork moved to ${FIXTURE_LOCATION}; 1 artwork already there|2 artworks already there)$`,
              ),
        ),
      ).toBeVisible();
      for (const title of [FIXTURE.toMove, FIXTURE.alreadyThere]) {
        await expect(rowOf(page, title)).toContainText(FIXTURE_LOCATION);
      }
    } finally {
      await closeStaffSession(opened);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the Locations tab, All artworks and a record's Location panel have no serious axe violations, ${theme}`, async ({
      browser,
      baseURL,
    }) => {
      const opened = await session(browser, baseURL, theme);
      try {
        await openLocations(opened.page);
        await expectNoSeriousAxeViolations(opened.page, LOCATIONS_PATH);
        // The fixture rows, so axe checks the Location column and the selection checkboxes.
        await openFixtureList(opened.page);
        await expectNoSeriousAxeViolations(opened.page, FIXTURE_LIST_PATH);
        // The seeded move gives the panel a current location and a history to check.
        const record = await openFixtureRecord(opened.page, FIXTURE.alreadyThere);
        await expect(nowAt(opened.page)).toHaveText(FIXTURE_LOCATION);
        await expectNoSeriousAxeViolations(opened.page, record);
      } finally {
        await closeStaffSession(opened);
      }
    });
  }

  test("the Locations tab fits a 375px phone with no sideways scroll", async ({
    browser,
    baseURL,
  }) => {
    const opened = await session(browser, baseURL, "light", { width: 375, height: 812 });
    try {
      await openLocations(opened.page);
      const overflow = await opened.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await closeStaffSession(opened);
    }
  });

  test("a Catalogue editor is offered Move on a record and the list; an account manager is not", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!rolesEnabled, "Set LAX_ADMIN_ROLES_E2E=1 for the demo role sign-ins.");
    if (!baseURL) throw new Error("baseURL is required");
    const roleSession = (email: string) =>
      openStaffSession({
        browser,
        baseURL,
        account: { email, password },
        theme: "light",
        viewport: { width: 1440, height: 1000 },
      });

    let recordPath: string;
    const editor = await roleSession("lax-catalogue@lax.bid");
    try {
      recordPath = await openFixtureRecord(editor.page, FIXTURE.alreadyThere);
      await expect(locationPanel(editor.page).getByRole("button", { name: "Move…" })).toBeVisible();
      await openFixtureList(editor.page);
      await rowOf(editor.page, FIXTURE.alreadyThere).getByRole("checkbox").check();
      await expect(editor.page.getByRole("button", { name: "Move selected…" })).toBeVisible();
    } finally {
      await closeStaffSession(editor);
    }

    const manager = await roleSession("lax-accounts@lax.bid");
    try {
      const { page } = manager;
      await openStaffPage(page, "/overview");
      // No From Zoho in the nav, and its record neither loads nor offers Move.
      await expect(
        page.locator("[data-staff-shell] nav").getByRole("link", { name: "From Zoho" }),
      ).toHaveCount(0);
      await page.goto(recordPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#main-content")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /^Move/ })).toHaveCount(0);
    } finally {
      await closeStaffSession(manager);
    }
  });

  test("a read-only role reads the list and a record with nothing to change or move", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!rolesEnabled, "Set LAX_ADMIN_ROLES_E2E=1 for the demo role sign-ins.");
    if (!baseURL) throw new Error("baseURL is required");
    const opened = await openStaffSession({
      browser,
      baseURL,
      account: { email: "lax-readonly@lax.bid", password },
      theme: "light",
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await openLocations(opened.page);
      await expect(opened.page.getByText(/View only/)).toBeVisible();
      await expect(opened.page.getByRole("button", { name: "Add location" })).toHaveCount(0);

      // The record's Location panel reads, with no Move; All artworks offers no selection.
      await openFixtureRecord(opened.page, FIXTURE.alreadyThere);
      await expect(nowAt(opened.page)).toHaveText(FIXTURE_LOCATION);
      await expect(locationPanel(opened.page).getByRole("button", { name: "Move…" })).toHaveCount(
        0,
      );
      await openFixtureList(opened.page);
      await expect(opened.page.getByRole("checkbox")).toHaveCount(0);
    } finally {
      await closeStaffSession(opened);
    }
  });
});
