import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import {
  buyerLogin,
  dismissCookieConsentIfVisible,
  e2eEnabled,
  e2eSkipReason,
} from "./helpers/auth";

/**
 * Account switching against the production build (`next build` then the standalone server), the
 * way the browser gates start it. A unit test cannot catch what the client router does with a
 * hop's cookie and redirect; only a built server shows it. Every test starts from a browser
 * profile that has never used Bid, and ends in the personal account, which is where the seeded
 * organisation owner (`estate-owner@lax.bid`) starts, so the other specs find the profile as
 * they expect. Runs in the `public-chromium` project: no saved session.
 */

type MenuAccount = { id: string; kind: "personal" | "organisation"; name: string };

const ACTING_COOKIE = "lax_acting_legal_entity_id";
/** Crowley Fine Art Ltd in the dev seed: an organisation the owner is not a member of. */
const FOREIGN_ORGANISATION_ID = "20000000-0000-4000-8000-000000000002";
const FOREIGN_ORGANISATION_NAME = "Crowley Fine Art Ltd";

const accountMenuButton = (page: Page) => page.getByRole("button", { name: /^account menu/i });
const workspaceSwitcher = (page: Page) => page.getByTestId("account-switcher");
const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 }).first();

/** Counts the restore hops a page asks for, however they are reached. */
function countRestoreRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/restore-account") count++;
  });
  return () => count;
}

async function accountsOf(
  page: Page,
): Promise<{ personal: MenuAccount; organisation: MenuAccount }> {
  const res = await page.request.get("/api/me/menu-context");
  expect(res.ok(), `menu context answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { accounts: MenuAccount[] | null };
  const personal = body.accounts?.find((account) => account.kind === "personal");
  const organisation = body.accounts?.find((account) => account.kind === "organisation");
  if (!personal || !organisation) throw new Error("The seeded owner needs both account kinds");
  return { personal, organisation };
}

/** Chooses an account in this browser as an earlier visit would have left it. */
async function useAccountInThisBrowser(context: BrowserContext, baseURL: string, id: string) {
  await context.addCookies([{ name: ACTING_COOKIE, value: id, url: baseURL }]);
}

async function openAccountMenuItem(page: Page, name: RegExp) {
  await dismissCookieConsentIfVisible(page);
  const item = page.getByRole("menuitem", { name });
  // The menu opens only once the header has hydrated, so a click before that is lost.
  await expect(async () => {
    if (!(await item.isVisible())) await accountMenuButton(page).click();
    await expect(item).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return item;
}

test.describe("account switching on the production build @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  test.describe.configure({ timeout: 180_000 });

  test("a fresh browser signs in to a page that renders, with at most one restore", async ({
    page,
  }) => {
    const restoreRequests = countRestoreRequests(page);

    await buyerLogin(page);

    await expect(pageHeading(page)).toBeVisible({ timeout: 30_000 });
    // A loop asks again about every second, so let it have the chance to.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3_000);
    expect(restoreRequests()).toBeLessThanOrEqual(1);
    expect(new URL(page.url()).pathname).not.toMatch(/restore-account|switch-account/);
  });

  test("switches Personal to the organisation from the avatar menu, and back from the sidebar", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);
    await page.goto("/bids");
    await expect(workspaceSwitcher(page)).toHaveCount(0);
    await expect(accountMenuButton(page)).toBeVisible({ timeout: 30_000 });

    // Personal to the organisation, from the avatar menu: the workspace frame, not the website's.
    const row = await openAccountMenuItem(page, new RegExp(organisation.name));
    await row.click();
    await expect(workspaceSwitcher(page)).toContainText(organisation.name, { timeout: 30_000 });
    await expect(workspaceSwitcher(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`Account: ${organisation.name},`),
    );

    // The organisation to Personal, from the sidebar: the website frame again.
    await workspaceSwitcher(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(accountMenuButton(page)).toBeVisible();
    await expect(pageHeading(page)).toBeVisible();
  });

  test("a cookie for an organisation the person left opens Personal with a notice, after one restore", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const restoreRequests = countRestoreRequests(page);
    await useAccountInThisBrowser(context, origin, FOREIGN_ORGANISATION_ID);

    await page.goto("/home");

    await expect(page.getByTestId("account-notice")).toContainText(
      `You're no longer a member of ${FOREIGN_ORGANISATION_NAME}, so Bid opened your personal account.`,
      { timeout: 30_000 },
    );
    await expect(workspaceSwitcher(page)).toHaveCount(0);
    await expect(pageHeading(page)).toBeVisible();
    expect(restoreRequests()).toBe(1);
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).not.toBe(
      FOREIGN_ORGANISATION_ID,
    );
  });
});
