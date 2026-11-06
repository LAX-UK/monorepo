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
/** Crowley Fine Art Ltd in the dev seed: an organisation the owner had a seat in and was removed from. */
const LEFT_ORGANISATION_ID = "20000000-0000-4000-8000-000000000002";
const LEFT_ORGANISATION_NAME = "Crowley Fine Art Ltd";
/** Crowley Arts Foundation in the dev seed: an organisation the owner was never a member of. */
const NEVER_MEMBER_ORGANISATION_ID = "20000000-0000-4000-8000-000000000003";
const NEVER_MEMBER_ORGANISATION_NAME = "Crowley Arts Foundation";

const accountMenuButton = (page: Page) => page.getByRole("button", { name: /^account menu/i });
const workspaceSwitcher = (page: Page) => page.getByTestId("account-switcher");
const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 }).first();

/** Counts the requests a page makes to one path, however they are reached. */
function countRequestsTo(page: Page, pathname: string): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === pathname) count++;
  });
  return () => count;
}

/** The restore hops a page asks for. */
const countRestoreRequests = (page: Page) => countRequestsTo(page, "/restore-account");

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

/** Opens the avatar menu and clicks a row, trying again if the menu re-renders under the pointer. */
async function clickAccountMenuItem(page: Page, name: RegExp) {
  await dismissCookieConsentIfVisible(page);
  const item = page.getByRole("menuitem", { name });
  // The menu opens only once the header has hydrated, and re-renders as its facts arrive.
  await expect(async () => {
    if (!(await item.isVisible())) await accountMenuButton(page).click();
    await item.click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("account switching on the production build @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  test.describe.configure({ timeout: 180_000 });

  test("a fresh browser signs in to a page that renders, in its account, with no restore hop", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    const restoreRequests = countRestoreRequests(page);

    await buyerLogin(page);

    await expect(pageHeading(page)).toBeVisible({ timeout: 30_000 });
    // The sign-in itself chose the account: the first page already has it.
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).toBeTruthy();
    // A loop asks again about every second, so let it have the chance to.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3_000);
    expect(restoreRequests()).toBe(0);
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
    await clickAccountMenuItem(page, new RegExp(organisation.name));
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
    // Sign-in leaves no restore marker (only the hop route does), so the first restore is allowed.
    await useAccountInThisBrowser(context, origin, LEFT_ORGANISATION_ID);

    await page.goto("/home");

    await expect(page.getByTestId("account-notice")).toContainText(
      `You're no longer a member of ${LEFT_ORGANISATION_NAME}, so Bid opened your personal account.`,
      { timeout: 30_000 },
    );
    await expect(workspaceSwitcher(page)).toHaveCount(0);
    await expect(pageHeading(page)).toBeVisible();
    expect(restoreRequests()).toBe(1);
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).not.toBe(
      LEFT_ORGANISATION_ID,
    );
  });

  test("a sign-in with another person's organisation in the browser names nothing and keeps the person's own account", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await useAccountInThisBrowser(context, origin, NEVER_MEMBER_ORGANISATION_ID);

    await buyerLogin(page);

    await expect(pageHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("account-notice")).toHaveCount(0);
    await expect(page.getByText(NEVER_MEMBER_ORGANISATION_NAME)).toHaveCount(0);
    const { personal } = await accountsOf(page);
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).toBe(personal.id);
  });

  test("the All accounts page switches to the organisation and opens its workspace, not the personal frame", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);
    await page.goto("/organisations");
    await expect(workspaceSwitcher(page)).toHaveCount(0);
    const switchRequests = countRequestsTo(page, "/switch-account");

    await page.getByRole("link", { name: `Open, ${organisation.name}` }).click();

    // The organisation's workspace frame, in its own account: the page is loaded afresh after the
    // switch, so the router never visits the hop with the personal layout it holds.
    await expect(workspaceSwitcher(page)).toContainText(organisation.name, { timeout: 30_000 });
    await expect(pageHeading(page)).toBeVisible();
    expect(switchRequests()).toBe(0);
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).not.toBe(personal.id);

    // Back to Personal so the profile ends where the other specs expect it.
    await workspaceSwitcher(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
  });
});
