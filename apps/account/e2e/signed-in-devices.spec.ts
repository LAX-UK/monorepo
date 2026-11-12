import { type BrowserContext, expect, test } from "@playwright/test";
import { signOutContext } from "../../../scripts/ci/e2e-sign-out.mjs";
import { signedOutState } from "./helpers/account-auth-state";
import { newPersonCredentials, newPersonSkipReason, signInAccount } from "./helpers/account-e2e";

const SECURITY = "/account/security";
const SIGN_INS = 5;
const STEP_UPS = 2;

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

test.describe("Signed-in devices @journey", () => {
  const skipReason = newPersonSkipReason();
  test.skip(skipReason !== null, skipReason ?? "");

  // Enable when a new sign-in on a browser replaces the sign-in that browser held before. Until
  // then every sign-in adds a row, so the final assertion cannot hold.
  test.fixme(
    true,
    "Needs the sign-in service to replace a browser's earlier sign-in (signed-in devices takeover).",
  );

  test("five sign-ins and two step-ups in one browser leave exactly one row", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const person = newPersonCredentials();
    if (!person) throw new Error("Check account credentials are required");
    const context = await browser.newContext({ storageState: signedOutState, baseURL });
    try {
      const page = await context.newPage();
      for (let signIn = 0; signIn < SIGN_INS; signIn++) {
        await signInAccount(page, person, SECURITY);
        if (signIn < STEP_UPS) await signInAccount(page, person, SECURITY, { stepUp: true });
        if (signIn < SIGN_INS - 1) await letSessionLapse(context);
      }

      await page.goto(SECURITY);
      const devices = page.locator("#signed-in-devices");
      await expect(devices.getByRole("heading", { name: "Where you're signed in" })).toBeVisible();
      await expect(devices.getByRole("listitem")).toHaveCount(1);
      await expect(devices.getByText("This device")).toBeVisible();
      await expect(devices.getByText("You're not signed in anywhere else.")).toBeVisible();
    } finally {
      await signOutContext(context, { origin: baseURL ?? "http://localhost:3040" }).catch(
        () => undefined,
      );
      await context.close();
    }
  });
});
