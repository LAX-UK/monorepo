import { randomUUID } from "node:crypto";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import { roleAuthState } from "./helpers/auth-state";
import { shoot } from "./helpers/collection-journeys";
import {
  type SeededDeliveries,
  removeDeliveryRequests,
  requireDeliveriesStack,
  seedDeliveryRequests,
} from "./helpers/deliveries-seed";

/**
 * Bid admin › Operations › Deliveries (docs/design/staff-gaps-delivery-zoho-alerts.md, D1–D6):
 * a buyer's request for a delivery price reaches the list, staff find it by search, open it in
 * the queue panel (focus on its title), step with J and K, and Escape returns them to the row.
 * The journey makes its own made-up sale, two won lots and their requests, and removes them
 * afterwards, so it never depends on demo data and never skips for want of it. Each state is
 * shot at 1440 and 375 wide, light and dark.
 *
 * Tagged `@smoke` as well as `@journey`, so the PR browser gate (`test:e2e:pr`, `@smoke|@roles`)
 * runs it on every pull request, not only the weekly stabilization run. It never skips: without
 * the e2e stack, staff credentials or `DATABASE_URL` it fails and says what is missing.
 */

const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;
const TAG = `E2E ${randomUUID().slice(0, 6)}`;

async function shootAll(page: Page, testInfo: TestInfo, name: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await shoot(page, testInfo, `deliveries-${name}-${size.name}-${scheme}`);
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test.describe("deliveries @smoke @journey", () => {
  test.describe.configure({ retries: 0 });

  let seeded: SeededDeliveries | null = null;
  test.beforeAll(async () => {
    requireDeliveriesStack();
    seeded = await seedDeliveryRequests(TAG);
  });
  test.afterAll(async () => {
    await removeDeliveryRequests(seeded);
  });

  test("finds a buyer's request, opens it in the queue panel and steps through", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/deliveries");
    const grid = page.getByRole("grid", { name: "Deliveries" });

    await test.step("Operations › Deliveries opens on Waiting for a price", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Deliveries/ }).first()).toHaveAttribute(
        "href",
        "/admin/deliveries",
      );
      const views = page.getByRole("navigation", { name: "Views" });
      const waiting = views.getByRole("link", { name: /Waiting for a price/ });
      await expect(waiting).toHaveAttribute("aria-current", "page");
      // The count is said with what it means (NAV-3): "Waiting for a price, 2 waiting".
      await expect(waiting).toHaveAccessibleName(/\d+ waiting/);
      for (const label of ["Quoted", "To dispatch", "On the way", "Delivered", "Closed"]) {
        await expect(views.getByRole("link", { name: new RegExp(label) })).toBeVisible();
      }
    });

    await test.step("search by destination finds the two requests", async () => {
      const search = page.getByRole("searchbox", { name: "Search deliveries" });
      await search.fill(TAG);
      await search.press("Enter");
      await expect(page).toHaveURL(/q=E2E/);
      // Each row names the tag more than once (buyer, sale and destination), so count rows.
      await expect(grid.getByRole("row").filter({ hasText: TAG })).toHaveCount(2);
      await expect(grid.getByText("Waiting for a price").first()).toBeVisible();
      await shootAll(page, testInfo, "1-waiting");
    });

    await test.step("a row opens the panel on its title; J and K step; Escape returns to the row", async () => {
      const firstRow = grid.getByRole("row").nth(1);
      await firstRow.getByRole("link").first().click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(page).toHaveURL(/record=/);
      await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await expect(panel.getByText("Buyer asked for a delivery price")).toBeVisible();
      // Beside the list at 1440 (D3): the Status, Price and Waiting columns stay in view.
      for (const column of ["Status", "Price", "Waiting"]) {
        await expect(grid.getByRole("columnheader", { name: column })).toBeInViewport();
      }
      const first = page.url();
      await page.keyboard.press("j");
      await expect(panel.getByText("2 of 2")).toBeVisible();
      // Each step is a URL (PRD-7): wait for it, as the other queue journeys do.
      await expect(page).not.toHaveURL(first);
      await page.keyboard.press("k");
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await expect(page).toHaveURL(first);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(firstRow).toBeFocused();
      // Shot last: going from 1440 to 375 and back turns the side panel into the modal one and
      // back, which hands focus to the list, so the keyboard steps above come first.
      await firstRow.getByRole("link").first().click();
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await shootAll(page, testInfo, "2-panel");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    });

    await test.step("a lot with no delivery says so, with a way back", async () => {
      await page.goto(`/admin/deliveries?record=${randomUUID()}`);
      const panel = page.getByRole("dialog");
      await expect(panel.getByText("This delivery could not be found")).toBeVisible();
      await panel.getByRole("button", { name: "Back to the list" }).click();
      await expect(panel).toHaveCount(0);
    });

    await test.step("an empty view says so, and a search that matches nothing offers to clear it", async () => {
      // The journey's requests are all waiting, so their sale has nothing on the way. A search or
      // sale is a filter, so an empty filtered view is "no results" with Clear filters (D6).
      await page.goto(`/admin/deliveries?view=on_the_way&q=${encodeURIComponent(TAG)}`);
      await expect(
        page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: /On the way/ }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByText("No deliveries match")).toBeVisible();
      await expect(grid.getByRole("row").filter({ hasText: TAG })).toHaveCount(0);
      await page.goto("/admin/deliveries?q=nothing-matches-this-search");
      await expect(page.getByText("No deliveries match")).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear filters" }).first()).toBeVisible();
      await shootAll(page, testInfo, "3-no-results");
    });
  });
});

/**
 * D5: the page is for roles with Lot fulfilment access. Operations (Fulfilment) works it; a
 * read-only staff member has no nav link and is sent to No access by the server, before any
 * buyer's address reaches the page.
 */
test.describe("deliveries access @roles", () => {
  test.describe.configure({ retries: 0 });
  test.beforeAll(() => requireDeliveriesStack());

  test.describe("operations @roles", () => {
    test.use({ storageState: roleAuthState.operations });

    test("opens Deliveries with its six views and the waiting count", async ({ page }) => {
      await page.goto("/admin/deliveries");
      await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();
      await expect(page.locator('nav a[href="/admin/deliveries"]').first()).toBeVisible();
      const views = page.getByRole("navigation", { name: "Views" });
      for (const label of [
        "Waiting for a price",
        "Quoted",
        "To dispatch",
        "On the way",
        "Delivered",
        "Closed",
      ]) {
        await expect(views.getByRole("link", { name: new RegExp(label) })).toBeVisible();
      }
      await expect(views.getByRole("link", { name: /Waiting for a price/ })).toHaveAccessibleName(
        /\d+ waiting/,
      );
    });
  });

  test.describe("read-only staff @roles", () => {
    test.use({ storageState: roleAuthState.readonlyStaff });

    test("is sent to No access and has no Deliveries link", async ({ page }) => {
      await page.goto("/admin/deliveries");
      await expect(page).toHaveURL(/\/admin\/no-access/);
      await expect(page.locator('a[href="/admin/deliveries"]')).toHaveCount(0);
    });
  });
});
