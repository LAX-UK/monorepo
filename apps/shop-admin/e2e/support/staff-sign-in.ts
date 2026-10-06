import type { Page } from "@playwright/test";
import { TOTP } from "otpauth";

function isOidcAuthorizeUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith("/oauth2/authorize");
  } catch {
    return /\/oauth2\/authorize(?:\?|$)/.test(url);
  }
}

/** Authorize often 302s to hosted login; Playwright can land on the bare authorize URL without UI. */
async function followAuthorizeToHostedLogin(page: Page, authBaseUrl: string): Promise<void> {
  if (!isOidcAuthorizeUrl(page.url())) return;

  const authorizeUrl = page.url();
  const authorizeRes = await page.request.get(authorizeUrl, { maxRedirects: 0 });
  const location = authorizeRes.headers().location;
  if (location && authorizeRes.status() >= 300 && authorizeRes.status() < 400) {
    await page.goto(new URL(location, authBaseUrl).toString(), { waitUntil: "domcontentloaded" });
    return;
  }

  await page
    .waitForURL((url) => !isOidcAuthorizeUrl(url.toString()), {
      timeout: 45_000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});

  if (isOidcAuthorizeUrl(page.url())) {
    const parsed = new URL(authorizeUrl);
    const loginUrl = new URL("/login", authBaseUrl);
    for (const [key, value] of parsed.searchParams.entries()) {
      loginUrl.searchParams.set(key, value);
    }
    await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
  }
}

async function resumeIfAlreadySignedIn(
  page: Page,
  authBaseUrl: string,
  destination: RegExp,
): Promise<boolean> {
  const continueLink = page.getByRole("link", { name: /^continue(?: to dashboard)?$/i }).first();
  if (!(await continueLink.isVisible().catch(() => false))) return false;
  await continueLink.click();
  await page.waitForURL(
    (url) => destination.test(url.toString()) || isOidcAuthorizeUrl(url.toString()),
    { timeout: 60_000, waitUntil: "domcontentloaded" },
  );
  if (isOidcAuthorizeUrl(page.url())) {
    await followAuthorizeToHostedLogin(page, authBaseUrl);
  }
  return destination.test(page.url());
}

export async function signInStaffThroughIdentity(input: {
  page: Page;
  authBaseUrl: string;
  email: string;
  password: string;
  totpSecret?: string;
  returnTo?: string;
}): Promise<void> {
  const returnTo = input.returnTo ?? "/";
  await input.page.goto(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await input.page.waitForURL(/\/auth\/|test-auth\.lax\.bid/, { timeout: 60_000 });
  await followAuthorizeToHostedLogin(input.page, input.authBaseUrl.replace(/\/+$/, ""));

  const continueToCredentials = input.page.getByRole("button", { name: /^continue$/i });
  const passwordField = input.page
    .locator('input[name="password"], input[autocomplete="current-password"]')
    .first();
  const emailField = input.page.locator('#email, input[name="email"], input[type="email"]').first();

  await Promise.race([
    continueToCredentials.waitFor({ state: "visible", timeout: 45_000 }),
    passwordField.waitFor({ state: "visible", timeout: 45_000 }),
    emailField.waitFor({ state: "visible", timeout: 45_000 }),
  ]).catch(() => {});

  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(input.email);
  }
  const emailFirstRoot = input.page.locator('#login-root[data-email-first="true"]');
  if (await emailFirstRoot.isVisible().catch(() => false)) {
    const emailStepContinue = emailFirstRoot
      .locator('[data-login-step="email"]')
      .getByRole("button", { name: /^continue$/i });
    if (await emailStepContinue.isVisible().catch(() => false)) {
      await emailStepContinue.click();
    } else {
      await input.page.locator("#login-form").evaluate((form) => {
        if (form instanceof HTMLFormElement) form.requestSubmit();
      });
    }
    await input.page
      .locator('[data-login-step="credentials"]:not([hidden])')
      .waitFor({ state: "attached", timeout: 45_000 });
  } else if (await continueToCredentials.isVisible().catch(() => false)) {
    await continueToCredentials.click();
  }

  const authBase = input.authBaseUrl.replace(/\/+$/, "");
  const shopAdminDestination = /test-shop-admin\.lax\.bid|localhost:3030/;
  if (await resumeIfAlreadySignedIn(input.page, authBase, shopAdminDestination)) {
    return;
  }

  if (input.page.url().includes("/two-factor")) {
    if (!input.totpSecret) {
      throw new Error("SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET is required for silver staff sign-in");
    }
    const totp = new TOTP({ secret: input.totpSecret });
    await input.page.locator("#totp-code").fill(totp.generate());
    await input.page
      .locator("#totp-form")
      .getByRole("button", { name: /verify|continue|submit/i })
      .click();
    await input.page.waitForURL(/test-shop-admin\.lax\.bid|localhost:3030|test-auth\.lax\.bid/, {
      timeout: 120_000,
    });
    if (
      !input.page.url().includes("test-shop-admin") &&
      !input.page.url().includes("localhost:3030")
    ) {
      await input.page.waitForURL(/test-shop-admin\.lax\.bid|localhost:3030/, { timeout: 120_000 });
    }
    return;
  }

  try {
    await passwordField.waitFor({ state: "visible", timeout: 45_000 });
  } catch (error) {
    if (isOidcAuthorizeUrl(input.page.url())) {
      await followAuthorizeToHostedLogin(input.page, input.authBaseUrl.replace(/\/+$/, ""));
      await passwordField.waitFor({ state: "visible", timeout: 45_000 });
    } else {
      throw new Error(
        `staff hosted login did not reach password step (url=${input.page.url()}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  await passwordField.fill(input.password);

  const signIn = input.page.getByRole("button", { name: /^sign in$/i });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await input.page
      .getByRole("button", { name: /sign in|log in|continue/i })
      .first()
      .click();
  }

  if (input.page.url().includes("/two-factor") && input.totpSecret) {
    const totp = new TOTP({ secret: input.totpSecret });
    await input.page.locator("#totp-code").fill(totp.generate());
    await input.page
      .locator("#totp-form")
      .getByRole("button", { name: /verify|continue|submit/i })
      .click();
  } else if (input.totpSecret) {
    const totp = new TOTP({ secret: input.totpSecret });
    const otpField = input.page.getByLabel(/authenticator|verification|code/i);
    await otpField.waitFor({ timeout: 30_000 });
    await otpField.fill(totp.generate());
    await input.page.getByRole("button", { name: /verify|continue|submit/i }).click();
  }

  if (isOidcAuthorizeUrl(input.page.url())) {
    const allow = input.page.getByRole("button", { name: /^allow$/i });
    if (await allow.isVisible().catch(() => false)) {
      await Promise.all([
        input.page.waitForURL(shopAdminDestination, {
          timeout: 120_000,
          waitUntil: "domcontentloaded",
        }),
        allow.click(),
      ]);
      return;
    }
  }

  const authorize = input.page.getByRole("button", { name: /authorize|allow|continue/i });
  if (await authorize.isVisible().catch(() => false)) {
    await authorize.click();
  }

  await input.page.waitForURL(shopAdminDestination, { timeout: 120_000 });
}
