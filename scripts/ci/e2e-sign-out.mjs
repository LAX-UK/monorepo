/**
 * Signs browsers out at the end of an automated check, through each product's own sign-out, so
 * the sign-in service ends the session instead of leaving a "Chrome on macOS" row behind in
 * Account > Security > Where you're signed in.
 *
 * Playwright is not imported here: callers pass in the objects they already hold (a browser
 * context, a test object), so every app's e2e folder shares this one module.
 */
import { existsSync } from "node:fs";

/**
 * Whether checks sign out at all. A run in CI starts from a throwaway stack with nothing to tidy,
 * and every sign-out spends the issuer's per-address request allowance that the run's own
 * sign-ins need, so it is off there. `E2E_SIGN_OUT=1` or `0` decides either way.
 */
export function signOutEnabled(env = process.env) {
  if (env.E2E_SIGN_OUT === "1") return true;
  if (env.E2E_SIGN_OUT === "0") return false;
  return !env.CI;
}

/** Where the Bid, Account and LAX Admin apps accept a sign-out request. */
export const DEFAULT_LOGOUT_PATH = "/api/auth/logout";

/**
 * Where the browser goes to end the sign-in service's session. Bid and LAX Admin answer a
 * script with `{ redirectTo }`; Account answers with a redirect. Null when the product ended the
 * session itself and has nowhere further to send the browser.
 */
export function endSessionTarget({ status, headers, body }, origin) {
  if (status >= 300 && status < 400) {
    const location = headers.location;
    return location ? new URL(location, origin).toString() : null;
  }
  if (status >= 200 && status < 300 && typeof body?.redirectTo === "string") {
    return new URL(body.redirectTo, origin).toString();
  }
  return null;
}

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Signs out the browser context through the product's sign-out route, then follows the redirect
 * to the sign-in service so its session ends too. A check that is about signing out passes
 * `force`, so it signs out in CI as well.
 */
export async function signOutContext(
  context,
  { origin, logoutPath = DEFAULT_LOGOUT_PATH, force = false },
) {
  if (!force && !signOutEnabled()) return;
  const publicOrigin = new URL(origin).origin;
  const response = await context.request.post(new URL(logoutPath, publicOrigin).toString(), {
    headers: { origin: publicOrigin, accept: "application/json" },
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  if (response.status() >= 400) {
    throw new Error(`Sign-out at ${logoutPath} answered ${response.status()}`);
  }
  const target = endSessionTarget(
    { status: response.status(), headers: response.headers(), body: await readBody(response) },
    publicOrigin,
  );
  if (!target) return;
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: "domcontentloaded" });
  } finally {
    await page.close();
  }
}

/** Signs out every saved browser state that exists, each in a context of its own. */
export async function signOutStorageStates(browser, { files, origin, logoutPath }) {
  const failures = [];
  if (!signOutEnabled()) return failures;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const context = await browser.newContext({ storageState: file });
    try {
      await signOutContext(context, { origin, logoutPath });
    } catch (error) {
      failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
  return failures;
}

/** Sign-ins a spec made itself, by context, each with the way to sign that context out. */
const signedIn = new Map();

/** Records that a spec signed in on this context, so the fixture signs it out afterwards. */
export function rememberSignIn(context, signOut) {
  if (!signOutEnabled()) return;
  signedIn.set(context, signOut);
}

/** The spec signed out on its own, so nothing is left to do for this context. */
export function forgetSignIn(context) {
  signedIn.delete(context);
}

/** Signs out every remembered context. A failure is logged and never fails the spec. */
export async function signOutRememberedSignIns() {
  const pending = [...signedIn];
  signedIn.clear();
  for (const [context, signOut] of pending) {
    try {
      await signOut(context);
    } catch (error) {
      console.warn(
        `[e2e] sign-out after the check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Extends a Playwright `test` so every spec using it signs out what it signed in, after it ends
 * and before its browser closes. Used as `export const test = withSignOutAfterEach(base)`.
 */
export function withSignOutAfterEach(base) {
  return base.extend({
    signOutAfterEach: [
      // Depending on `context` makes this teardown run while the browser is still open.
      async ({ context: _context }, use) => {
        await use(undefined);
        await signOutRememberedSignIns();
      },
      { auto: true },
    ],
  });
}
