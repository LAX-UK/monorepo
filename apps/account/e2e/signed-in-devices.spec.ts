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
): Promise<SignedInBrowser> {
  const context = await browser.newContext({ storageState: signedOutState, baseURL });
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
});
