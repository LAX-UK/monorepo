import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  expect,
  test,
} from "@playwright/test";
import { signOutContext } from "../../../scripts/ci/e2e-sign-out.mjs";
import { signedOutState } from "./helpers/account-auth-state";
import {
  type AccountCredentials,
  devicesPersonCredentials,
  devicesPersonSkipReason,
  signInAccount,
} from "./helpers/account-e2e";
import { flushAuthRateLimits } from "./helpers/flush-auth-rate-limits";

const SECURITY = "/account/security";
const SIGN_INS = 5;
const STEP_UPS = 2;
/** The issuer asks again once a sign-in is older than five minutes; wait just past that. */
const STALE_AFTER_MS = 5 * 60_000 + 20_000;
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const FIREFOX_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";

type SignedInBrowser = { context: BrowserContext; page: Page };

/**
 * Ends the sign-in the browser holds without signing out, the way a returning visitor's session
 * runs out: every session cookie goes, and every other cookie stays, including the marker that
 * lets the sign-in service recognise the browser.
 */
async function letSessionLapse(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  const kept = cookies.filter((cookie) => !/session/i.test(cookie.name));
  await context.clearCookies();
  await context.addCookies(kept);
}

function devicesSection(page: Page): Locator {
  return page.locator("#signed-in-devices");
}

/** A new browser, signed in as the person and left on the security page. */
async function openSignedInBrowser(
  browser: Browser,
  baseURL: string | undefined,
  person: AccountCredentials,
  userAgent?: string,
): Promise<SignedInBrowser> {
  const context = await browser.newContext({
    storageState: signedOutState,
    baseURL,
    ...(userAgent ? { userAgent } : {}),
  });
  const page = await context.newPage();
  await signInAccount(page, person, SECURITY);
  return { context, page };
}

/** Signs a browser out and closes it. Quiet: a browser already signed out has nothing to do. */
async function closeBrowser(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  await signOutContext(context, {
    origin: baseURL ?? "http://localhost:3040",
    force: true,
  }).catch(() => undefined);
  await context.close();
}

/** Confirms on the issuer's "Confirm it's you" page: the email is fixed, so only the password. */
async function confirmOnIssuer(page: Page, person: AccountCredentials): Promise<void> {
  await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible({
    timeout: 45_000,
  });
  const email = page.locator("#email");
  if (await email.isVisible().catch(() => false)) {
    await email.fill(person.email);
    const next = page.getByRole("button", { name: /^continue$/i });
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  await page.locator('input[autocomplete="current-password"]').first().fill(person.password);
  await page
    .getByRole("button", { name: /^(continue|sign in)$/i })
    .first()
    .click();
}

test.describe("Signed-in devices @journey", () => {
  const skipReason = devicesPersonSkipReason();
  test.skip(skipReason !== null, skipReason ?? "");
  // One person, and each journey counts their browsers, so the journeys take turns.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => flushAuthRateLimits());

  function requirePerson(): AccountCredentials {
    const person = devicesPersonCredentials();
    if (!person) throw new Error("Check account credentials are required");
    return person;
  }

  test("five sign-ins and two step-ups in one browser leave exactly one row", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const person = requirePerson();
    const context = await browser.newContext({ storageState: signedOutState, baseURL });
    try {
      const page = await context.newPage();
      for (let signIn = 0; signIn < SIGN_INS; signIn++) {
        await signInAccount(page, person, SECURITY);
        if (signIn < STEP_UPS) await signInAccount(page, person, SECURITY, { stepUp: true });
        if (signIn < SIGN_INS - 1) await letSessionLapse(context);
      }

      await page.goto(SECURITY);
      const devices = devicesSection(page);
      await expect(devices.getByRole("heading", { name: "Where you're signed in" })).toBeVisible();
      await expect(devices.getByRole("listitem")).toHaveCount(1);
      await expect(devices.getByText("This device")).toBeVisible();
      await expect(devices.getByText("You're not signed in anywhere else.")).toBeVisible();
    } finally {
      await closeBrowser(context, baseURL);
    }
  });

  test("signing out of one browser leaves the person's other browser signed in", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const person = requirePerson();
    const first = await openSignedInBrowser(browser, baseURL, person);
    const second = await openSignedInBrowser(browser, baseURL, person);
    try {
      await first.page.goto(SECURITY);
      await expect(devicesSection(first.page).getByRole("listitem")).toHaveCount(2);

      await signOutContext(second.context, {
        origin: baseURL ?? "http://localhost:3040",
        force: true,
      });

      await first.page.goto(SECURITY);
      const devices = devicesSection(first.page);
      await expect(devices.getByRole("listitem")).toHaveCount(1);
      await expect(devices.getByText("This device")).toBeVisible();
      await expect(devices.getByText("You're not signed in anywhere else.")).toBeVisible();
    } finally {
      await closeBrowser(first.context, baseURL);
      await closeBrowser(second.context, baseURL);
    }
  });

  test("signing out one other device keeps this one and the rest", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const person = requirePerson();
    const first = await openSignedInBrowser(browser, baseURL, person);
    const second = await openSignedInBrowser(browser, baseURL, person);
    const third = await openSignedInBrowser(browser, baseURL, person);
    try {
      await first.page.goto(SECURITY);
      const devices = devicesSection(first.page);
      await expect(devices.getByRole("listitem")).toHaveCount(3);

      await devices
        .getByRole("button", { name: /^Sign out/ })
        .first()
        .click();
      await first.page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
      await expect(devices.getByRole("listitem")).toHaveCount(2);
      await expect(devices.getByText("This device")).toBeVisible();
    } finally {
      await closeBrowser(first.context, baseURL);
      await closeBrowser(second.context, baseURL);
      await closeBrowser(third.context, baseURL);
    }
  });

  test("sign out everywhere else keeps only this browser", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const person = requirePerson();
    const first = await openSignedInBrowser(browser, baseURL, person);
    const second = await openSignedInBrowser(browser, baseURL, person);
    const third = await openSignedInBrowser(browser, baseURL, person);
    try {
      await first.page.goto(SECURITY);
      const devices = devicesSection(first.page);
      await expect(devices.getByRole("listitem")).toHaveCount(3);

      await devices.getByRole("button", { name: "Sign out everywhere else" }).click();
      await first.page
        .getByRole("dialog")
        .getByRole("button", { name: "Sign out everywhere else" })
        .click();
      await expect(devices.getByText("You're signed out everywhere else.")).toBeVisible();

      await first.page.goto(SECURITY);
      await expect(devices.getByRole("listitem")).toHaveCount(1);
      await expect(devices.getByText("This device")).toBeVisible();
      await expect(devices.getByText("You're not signed in anywhere else.")).toBeVisible();
    } finally {
      await closeBrowser(first.context, baseURL);
      await closeBrowser(second.context, baseURL);
      await closeBrowser(third.context, baseURL);
    }
  });

  test("a sign-in older than five minutes confirms it's you without leaving the page", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(15 * 60_000);
    const person = requirePerson();
    const main = await openSignedInBrowser(browser, baseURL, person);
    const blocked = await openSignedInBrowser(browser, baseURL, person, FIREFOX_WINDOWS);
    const safari = await openSignedInBrowser(browser, baseURL, person, SAFARI_MAC);
    const edge = await openSignedInBrowser(browser, baseURL, person, EDGE_WINDOWS);
    try {
      await main.page.waitForTimeout(STALE_AFTER_MS);

      // In a small window: the page itself never navigates, and the device goes.
      await main.page.goto(SECURITY);
      // A mark on this document: a reload or another page would lose it. Same-document history
      // updates, which Next makes after a server action or a refresh, keep it.
      await main.page.evaluate(() => {
        (window as Window & { stayedOnPage?: boolean }).stayedOnPage = true;
      });
      const devices = devicesSection(main.page);
      await devices.getByRole("button", { name: /^Sign out Safari/ }).click();
      const dialog = main.page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Sign out" }).click();
      await expect(dialog.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
      await expect(dialog).toContainText("before you sign out another device");
      const popupOpened = main.page.waitForEvent("popup");
      await dialog.getByRole("button", { name: "Continue" }).click();
      const popup = await popupOpened;
      await confirmOnIssuer(popup, person);
      await popup.waitForEvent("close", { timeout: 60_000 });
      await expect(devices.getByText(/Safari .* is signed out\./)).toBeVisible();
      await expect(devices.getByRole("button", { name: /^Sign out Safari/ })).toHaveCount(0);
      expect(
        await main.page.evaluate(
          () => (window as Window & { stayedOnPage?: boolean }).stayedOnPage === true,
        ),
      ).toBe(true);

      // Window blocked: a full-page sign-in, then the same dialog again for one more click.
      await blocked.page.addInitScript(() => {
        window.open = () => null;
      });
      await blocked.page.goto(SECURITY);
      const blockedDevices = devicesSection(blocked.page);
      await blockedDevices.getByRole("button", { name: /^Sign out Edge/ }).click();
      const blockedDialog = blocked.page.getByRole("dialog");
      await blockedDialog.getByRole("button", { name: "Sign out" }).click();
      await blockedDialog.getByRole("button", { name: "Continue" }).click();
      await confirmOnIssuer(blocked.page, person);
      await blocked.page.waitForURL((url) => url.pathname === SECURITY, { timeout: 60_000 });
      await expect(blockedDialog.getByRole("heading", { name: /^Sign out Edge/ })).toBeVisible();
      await expect.poll(() => new URL(blocked.page.url()).searchParams.has("resume")).toBe(false);
      await blockedDialog.getByRole("button", { name: "Sign out" }).click();
      await expect(blockedDevices.getByRole("button", { name: /^Sign out Edge/ })).toHaveCount(0);
    } finally {
      await closeBrowser(main.context, baseURL);
      await closeBrowser(blocked.context, baseURL);
      await closeBrowser(safari.context, baseURL);
      await closeBrowser(edge.context, baseURL);
    }
  });
});
