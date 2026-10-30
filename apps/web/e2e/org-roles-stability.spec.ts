import { type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * The account in use stays put while an owner works across the workspace: 30 moves between pages
 * without a reload keep the organisation, and the shell they sit in is the same one throughout.
 * A switch made in a second tab reaches the first as a notice, never as a silent change.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const PAGES = ["/home", "/bids", "/purchases", "/organisation", "/team", "/organisation/documents"];
const MOVES = 30;

type Marked = Window & { __shellMarker?: string; next?: { router?: { push(path: string): void } } };

/** Moves to a page the way a click does, through the app's own navigation and without a reload. */
async function moveTo(page: Page, path: string) {
  const link = page.locator(`a[href="${path}"]:visible`).first();
  if (await link.count()) await link.click();
  else await page.evaluate((to) => (window as Marked).next?.router?.push(to), path);
  await page.waitForURL((url) => url.pathname === path);
}

test.describe("organisation account stability @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("keeps the organisation and the shell across 30 moves", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    const { page } = owner;
    await page.goto("/home");
    await expectActingAs(page, approved, "Owner");
    await page.evaluate(() => {
      (window as Marked).__shellMarker = "kept";
      document.querySelector("[data-testid=account-switcher]")?.setAttribute("data-kept", "yes");
    });

    for (let move = 0; move < MOVES; move++) {
      const path = PAGES[(move + 1) % PAGES.length] ?? "/home";
      await moveTo(page, path);
      await expectActingAs(page, approved, "Owner");
      await expect(page.getByText("We couldn't load your accounts")).toHaveCount(0);
      // Still the same document and the same account switcher: nothing reloaded or remounted.
      expect(await page.evaluate(() => (window as Marked).__shellMarker)).toBe("kept");
      await expect(page.getByTestId("account-switcher")).toHaveAttribute("data-kept", "yes");
    }
    await owner.close();
  });

  test("a switch in a second tab is announced in the first", async ({ browser, baseURL }) => {
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    const { page, context } = owner;
    await page.goto("/organisation");
    await expectActingAs(page, approved, "Owner");

    const other = await context.newPage();
    await other.goto("/home");
    await expectActingAs(other, approved, "Owner");
    await other
      .getByRole("button", { name: `Account: ${approved},` })
      .first()
      .click();
    await other.getByTestId("switch-account-personal").click();
    await expect(other.getByTestId("account-switcher")).toHaveCount(0);

    await page.bringToFront();
    await expect(page.getByTestId("account-notice")).toContainText(
      "You switched to your personal account in another tab",
    );
    await expect(page.getByTestId("account-switcher")).toHaveCount(0);

    // Nothing was mixed up: a reload of the first tab is the personal account too.
    await page.reload();
    await expect(page.getByTestId("account-switcher")).toHaveCount(0);
    await owner.close();
  });
});
