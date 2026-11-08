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

/** The top-right account button: "Account menu" alone, "Your accounts, …" with an organisation. */
const accountMenuButton = (page: Page) =>
  page.getByRole("button", { name: /^(account menu|your accounts)/i });
const workspaceSwitcher = (page: Page) => page.getByTestId("account-switcher");
const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 }).first();
/** The greeting after a chosen switch: a polite live region the message is put into once loaded. */
const switchNotice = (page: Page) => page.getByTestId("account-switch-greeting");
const pathOf = (page: Page) => new URL(page.url()).pathname;

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

/** The hop a record link takes to open `next` in an account (the app's own link, as written). */
const switchHrefFor = (accountId: string, next = "/bids") =>
  `/switch-account?${new URLSearchParams({ to: accountId, next }).toString()}`;

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
    // Bids exist in both accounts, so the person stays on them; the new page says who they act
    // as, once, and focus is on its heading.
    expect(pathOf(page)).toBe("/bids");
    await expect(switchNotice(page)).toContainText(`Now acting as ${organisation.name}`);
    await expect(page.locator("h1:focus")).toHaveCount(1);

    // The organisation to Personal, from the sidebar: the website frame again, still on Bids.
    await workspaceSwitcher(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(accountMenuButton(page)).toBeVisible();
    await expect(pageHeading(page)).toBeVisible();
    expect(pathOf(page)).toBe("/bids");
    await expect(switchNotice(page)).toContainText("Now using your personal account");
    await expect(page.locator("h1:focus")).toHaveCount(1);
  });

  test("a page only one account has opens the other account's first page, and a public page stays put", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);
    // Sign-in may still be settling onto its landing page; wait for it before asking for this one.
    await page.waitForLoadState("networkidle");
    await page.goto("/selling/new");
    await expect(accountMenuButton(page)).toBeVisible({ timeout: 30_000 });

    await clickAccountMenuItem(page, new RegExp(organisation.name));

    await expect(workspaceSwitcher(page)).toContainText(organisation.name, { timeout: 30_000 });
    expect(pathOf(page)).toBe("/home");

    // Back to Personal so the profile ends where the other specs expect it.
    await workspaceSwitcher(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/about");
    await expect(accountMenuButton(page)).toBeVisible({ timeout: 30_000 });

    await clickAccountMenuItem(page, new RegExp(organisation.name));

    // The About page is the same for every account, so the person stays on it; the root greeting
    // still speaks, in a polite live region, and does not linger on later pages.
    await expect(switchNotice(page)).toContainText(`Now acting as ${organisation.name}`, {
      timeout: 30_000,
    });
    await expect(switchNotice(page)).toHaveAttribute("aria-live", "polite");
    expect(pathOf(page)).toBe("/about");
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).not.toBe(personal.id);
    expect(cookies.find((cookie) => cookie.name === "lax_account_notice")).toBeUndefined();

    // Back to Personal so the profile ends where the other specs expect it.
    await clickAccountMenuItem(page, /Personal/);
    await expect(switchNotice(page)).toContainText("Now using your personal account", {
      timeout: 30_000,
    });
    expect(pathOf(page)).toBe("/about");
  });

  test("the top-right account button shows the account in use, record links say where they opened, and sign-out clears the choice", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);
    await page.setViewportSize({ width: 1440, height: 900 });

    // A public page, in Personal: the person's avatar, their name and the word Personal.
    await page.goto("/about");
    const button = accountMenuButton(page);
    await expect(button).toBeVisible({ timeout: 30_000 });
    await expect(button).toHaveAccessibleName(/^Your accounts, .+, Personal$/);
    await expect(button).toContainText("Personal");

    // Switching there opens the workspace, whose top-right button shows the organisation's tile
    // and is the switcher too.
    await clickAccountMenuItem(page, new RegExp(organisation.name));
    await expect(switchNotice(page)).toContainText(`Now acting as ${organisation.name}`, {
      timeout: 30_000,
    });
    await page.goto("/home");
    await expect(accountMenuButton(page)).toHaveAccessibleName(
      `Your accounts, acting as ${organisation.name}`,
      { timeout: 30_000 },
    );
    await accountMenuButton(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(accountMenuButton(page)).toHaveAccessibleName(/^Your accounts, .+, Personal$/);

    // A record link that opens the other account says so and offers the way back. It is a link on
    // this site, as a record page sends it: same-origin, so no confirmation.
    await page.goto("/about");
    await expect(accountMenuButton(page)).toBeVisible({ timeout: 30_000 });
    await page.evaluate((href) => window.location.assign(href), switchHrefFor(organisation.id));
    const toast = page.getByTestId("record-switch-toast");
    await expect(toast).toContainText(`Opened in ${organisation.name}`, { timeout: 30_000 });
    await expect(toast).toContainText("This record belongs to the organisation.");
    await toast.getByRole("button", { name: "Back to Personal" }).click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(accountMenuButton(page)).toHaveAccessibleName(/^Your accounts, .+, Personal$/);

    // Signing out clears the account choice on the server, whatever the page does after: the
    // browser's own cleanup (which also runs) is not what this proves.
    await useAccountInThisBrowser(context, origin, organisation.id);
    const response = await page.request.post("/api/auth/logout", { headers: { origin } });
    expect(response.ok()).toBe(true);
    expect((await context.cookies(origin)).some((c) => c.name === ACTING_COOKIE)).toBe(false);
  });

  test("on a phone the account button switches in the Switch account sheet, in Personal and back", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/bids");
    await dismissCookieConsentIfVisible(page);

    // Personal: a round avatar and the word Personal, and a sheet with every account.
    const accountButton = page.getByTestId("phone-account-button");
    await expect(accountButton).toBeVisible({ timeout: 30_000 });
    await expect(accountButton).toHaveAccessibleName(/^Your accounts, .+, Personal$/);
    await accountButton.click();
    const sheet = page.getByRole("dialog", { name: "Switch account" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("switch-account-personal")).toContainText("Current");
    await sheet.getByRole("button", { name: new RegExp(organisation.name) }).click();

    // The organisation: its tile with the person's badge, on the same page, with the greeting.
    await expect(switchNotice(page)).toContainText(`Now acting as ${organisation.name}`, {
      timeout: 30_000,
    });
    expect(pathOf(page)).toBe("/bids");
    await expect(page.getByTestId("phone-account-button")).toHaveAccessibleName(
      `Your accounts, acting as ${organisation.name}`,
    );

    // And back, from the same button.
    await page.getByTestId("phone-account-button").click();
    await page
      .getByRole("dialog", { name: "Switch account" })
      .getByTestId("switch-account-personal")
      .click();
    await expect(switchNotice(page)).toContainText("Now using your personal account", {
      timeout: 30_000,
    });
    expect(pathOf(page)).toBe("/bids");
    await expect(page.getByTestId("phone-account-button")).toHaveAccessibleName(
      /^Your accounts, .+, Personal$/,
    );
  });

  test("an organisation page in Personal offers a one-tap switch and never switches by itself", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    const { personal, organisation } = await accountsOf(page);
    await useAccountInThisBrowser(context, origin, personal.id);

    // Sign-in may still be settling onto its landing page; wait for it before asking for Team.
    await page.waitForLoadState("networkidle");
    await page.goto("/team");

    // One organisation names it and offers a link; several offer the account switcher.
    await expect(page.getByRole("heading", { level: 1, name: /^Team belongs to/ })).toBeVisible({
      timeout: 30_000,
    });
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === ACTING_COOKIE)?.value).toBe(personal.id);

    const switchLink = page.getByRole("link", { name: /^Switch to / });
    if (await switchLink.count()) {
      await switchLink.click();
    } else {
      await page.getByTestId("no-access-switch").click();
      await page.getByRole("button", { name: new RegExp(organisation.name) }).click();
    }

    await expect(workspaceSwitcher(page)).toContainText(organisation.name, { timeout: 30_000 });
    expect(pathOf(page)).toBe("/team");

    // Back to Personal so the profile ends where the other specs expect it.
    await workspaceSwitcher(page).click();
    await page.getByTestId("switch-account-personal").click();
    await expect(workspaceSwitcher(page)).toHaveCount(0, { timeout: 30_000 });
  });

  test("a cookie for an organisation the person left opens Personal with a notice, after one restore", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://localhost:3000";
    await buyerLogin(page);
    // Sign-in is still moving on to its landing page. Let it finish before the stale cookie is set:
    // a cookie set earlier is restored by that landing load, which shows the notice (and clears
    // it) before this test opens the page it is checking, so the page then has nothing to say.
    await page.waitForLoadState("networkidle");
    await expect(pageHeading(page)).toBeVisible({ timeout: 30_000 });
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
    // Sign-in may still be settling onto its landing page; wait for it before asking for this one.
    await page.waitForLoadState("networkidle");
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
