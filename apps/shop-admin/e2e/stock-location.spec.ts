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
 * From Zoho › Locations (docs/design/stock-location.md) against the running stack: an
 * Administrator keeps the list (add, rename, retire, restore), the page passes axe in both themes,
 * fits a 375px phone, and a read-only role sees the list with nothing to change. Moving artworks
 * needs artworks on the register, which the CI seed does not have; the component tests cover it.
 */

const LOCATIONS_PATH = "/from-zoho?tab=locations";
const account = administratorAccount();
const rolesEnabled = process.env.LAX_ADMIN_ROLES_E2E === "1";
const password = process.env.LAX_ADMIN_ROLES_PASSWORD ?? "Password123!";

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

  for (const theme of ["light", "dark"] as const) {
    test(`the Locations tab and All artworks have no serious axe violations, ${theme}`, async ({
      browser,
      baseURL,
    }) => {
      const opened = await session(browser, baseURL, theme);
      try {
        await openLocations(opened.page);
        await expectNoSeriousAxeViolations(opened.page, LOCATIONS_PATH);
        await openStaffPage(opened.page, "/from-zoho?tab=all");
        await expectNoSeriousAxeViolations(opened.page, "/from-zoho?tab=all");
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

  test("a read-only role reads the list with nothing to change", async ({ browser, baseURL }) => {
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
    } finally {
      await closeStaffSession(opened);
    }
  });
});
