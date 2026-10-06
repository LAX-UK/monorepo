import type { Page } from "@playwright/test";
import { TOTP } from "otpauth";

const SHOP_ADMIN_DESTINATION = /test-shop-admin\.lax\.bid|localhost:3030/;

function isOidcAuthorizeUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith("/oauth2/authorize");
  } catch {
    return /\/oauth2\/authorize(?:\?|$)/.test(url);
  }
}

function isShopAdminOidcCallbackUrl(url: string): boolean {
  try {
    return new URL(url).pathname === "/api/auth/callback";
  } catch {
    return /\/api\/auth\/callback(?:\?|$)/.test(url);
  }
}

function reachedShopAdmin(url: string, destination: RegExp): boolean {
  return destination.test(url);
}

function reachedPostAuthHop(url: string, destination: RegExp): boolean {
  return (
    reachedShopAdmin(url, destination) || isShopAdminOidcCallbackUrl(url) || isOidcAuthorizeUrl(url)
  );
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

async function completeOidcConsentViaApi(
  page: Page,
  authBaseUrl: string,
  destination: RegExp,
): Promise<void> {
  const authorizeUrl = page.url();
  if (!isOidcAuthorizeUrl(authorizeUrl)) return;
  if (reachedShopAdmin(authorizeUrl, destination)) return;

  const authorizeRes = await page.request.get(authorizeUrl, { maxRedirects: 0 });
  const location = authorizeRes.headers().location;
  if (location && authorizeRes.status() >= 300 && authorizeRes.status() < 400) {
    await page.goto(new URL(location, authBaseUrl).toString(), { waitUntil: "domcontentloaded" });
    if (!reachedShopAdmin(page.url(), destination)) {
      await page.waitForURL((url) => reachedPostAuthHop(url.toString(), destination), {
        timeout: 60_000,
        waitUntil: "domcontentloaded",
      });
    }
    return;
  }

  const contentType = authorizeRes.headers()["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    const body = (await authorizeRes.json().catch(() => null)) as {
      url?: string;
      redirectURI?: string;
    } | null;
    const redirectUri = body?.url ?? body?.redirectURI;
    if (typeof redirectUri !== "string") {
      throw new Error(`OIDC authorize JSON omitted a redirect (${authorizeRes.status()})`);
    }
    await page.goto(redirectUri, { waitUntil: "domcontentloaded" });
    return;
  }

  if (!authorizeRes.ok()) {
    throw new Error(`OIDC authorize failed (${authorizeRes.status()})`);
  }

  const consentHtml = await authorizeRes.text();
  const consentCode = consentHtml.match(/id="consent-code"[^>]+value="([^"]+)"/)?.[1];
  if (!consentCode) {
    throw new Error(`OIDC authorize did not render a consent code (${authorizeUrl})`);
  }

  const consent = await page.request.post(`${authBaseUrl}/api/auth/oauth2/consent`, {
    headers: { "content-type": "application/json", origin: authBaseUrl },
    data: { accept: true, consent_code: consentCode },
  });
  const body = (await consent.json().catch(() => null)) as { redirectURI?: string } | null;
  if (!consent.ok() || typeof body?.redirectURI !== "string") {
    throw new Error(`OIDC consent failed (${consent.status()})`);
  }

  await page.goto(body.redirectURI, { waitUntil: "domcontentloaded" });
}

async function submitOidcAllowIfVisible(page: Page, destination: RegExp): Promise<boolean> {
  const allow = page.getByRole("button", { name: /^allow$/i });
  if (!(await allow.isVisible().catch(() => false))) return false;
  await Promise.all([
    page.waitForURL((url) => reachedPostAuthHop(url.toString(), destination), {
      timeout: 90_000,
      waitUntil: "domcontentloaded",
    }),
    allow.click(),
  ]).catch(() => {});
  return true;
}

async function completeStaffLoginReturn(
  page: Page,
  authBaseUrl: string,
  destination: RegExp,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (reachedShopAdmin(url, destination)) return;

    if (isShopAdminOidcCallbackUrl(url)) {
      await page.waitForURL(destination, { timeout: 90_000, waitUntil: "domcontentloaded" });
      if (reachedShopAdmin(page.url(), destination)) return;
    }

    if (isOidcAuthorizeUrl(url)) {
      if (await submitOidcAllowIfVisible(page, destination)) continue;
      await completeOidcConsentViaApi(page, authBaseUrl, destination);
      continue;
    }

    const continueLink = page.getByRole("link", { name: /^continue(?: to dashboard)?$/i }).first();
    if (await continueLink.isVisible().catch(() => false)) {
      await continueLink.click();
      await page
        .waitForURL((u) => reachedPostAuthHop(u.toString(), destination), {
          timeout: 60_000,
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
      continue;
    }

    const totpError = page.locator(
      '#totp-code-error:not([hidden]), #error[role="alert"]:not([hidden])',
    );
    if (await totpError.isVisible().catch(() => false)) {
      const text = ((await totpError.textContent()) ?? "").trim();
      throw new Error(`Staff MFA or login failed (${url}): ${text || "unknown error"}`);
    }

    await page.waitForTimeout(400);
  }

  throw new Error(`Staff sign-in did not reach shop-admin (${page.url()})`);
}

async function resumeIfAlreadySignedIn(
  page: Page,
  authBaseUrl: string,
  destination: RegExp,
): Promise<boolean> {
  const continueLink = page.getByRole("link", { name: /^continue(?: to dashboard)?$/i }).first();
  if (!(await continueLink.isVisible().catch(() => false))) return false;
  await continueLink.click();
  await page.waitForURL((url) => reachedPostAuthHop(url.toString(), destination), {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
  if (isOidcAuthorizeUrl(page.url())) {
    await followAuthorizeToHostedLogin(page, authBaseUrl);
  }
  if (reachedShopAdmin(page.url(), destination)) return true;
  await completeStaffLoginReturn(page, authBaseUrl, destination);
  return true;
}

async function submitStaffTotp(page: Page, authBaseUrl: string, totpSecret: string): Promise<void> {
  const totpField = page.locator("#totp-code");
  await totpField.waitFor({ state: "visible", timeout: 45_000 });
  const totp = new TOTP({ secret: totpSecret });
  await totpField.fill(totp.generate());
  const verify = page
    .locator("#totp-form")
    .getByRole("button", { name: /verify|continue|submit/i });
  const verifyResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/two-factor/verify-totp") &&
      response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await verify.click();
  const response = await verifyResponse;
  if (!response.ok()) {
    throw new Error(`staff TOTP verify failed (${response.status()})`);
  }
  const payload = (await response.json().catch(() => null)) as {
    url?: string;
    redirectURI?: string;
  } | null;
  const next =
    typeof payload?.url === "string"
      ? payload.url
      : typeof payload?.redirectURI === "string"
        ? payload.redirectURI
        : null;
  if (next) {
    await page.goto(new URL(next, authBaseUrl).toString(), { waitUntil: "domcontentloaded" });
    return;
  }
  await page
    .waitForURL((url) => reachedPostAuthHop(url.toString(), SHOP_ADMIN_DESTINATION), {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

export async function signInStaffThroughIdentity(input: {
  page: Page;
  authBaseUrl: string;
  email: string;
  password: string;
  totpSecret?: string;
  returnTo?: string;
}): Promise<void> {
  const authBase = input.authBaseUrl.replace(/\/+$/, "");
  const destination = SHOP_ADMIN_DESTINATION;
  const returnTo = input.returnTo ?? "/";

  await input.page.goto(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await input.page.waitForURL(/\/auth\/|test-auth\.lax\.bid/, { timeout: 60_000 });
  await followAuthorizeToHostedLogin(input.page, authBase);

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

  if (await resumeIfAlreadySignedIn(input.page, authBase, destination)) {
    return;
  }

  if (input.page.url().includes("/two-factor")) {
    if (!input.totpSecret) {
      throw new Error("SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET is required for silver staff sign-in");
    }
    await submitStaffTotp(input.page, authBase, input.totpSecret);
    await completeStaffLoginReturn(input.page, authBase, destination);
    return;
  }

  try {
    await passwordField.waitFor({ state: "visible", timeout: 45_000 });
  } catch (error) {
    if (isOidcAuthorizeUrl(input.page.url())) {
      await followAuthorizeToHostedLogin(input.page, authBase);
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

  if (input.totpSecret) {
    const totpField = input.page.locator("#totp-code");
    const needsTotp =
      input.page.url().includes("/two-factor") ||
      (await totpField.isVisible().catch(() => false)) ||
      (await totpField
        .waitFor({ state: "visible", timeout: 20_000 })
        .then(() => true)
        .catch(() => false));
    if (needsTotp) {
      await submitStaffTotp(input.page, authBase, input.totpSecret);
    }
  }

  await completeStaffLoginReturn(input.page, authBase, destination);
}
