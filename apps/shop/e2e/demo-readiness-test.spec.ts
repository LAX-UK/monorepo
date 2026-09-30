import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

const enabled = process.env.DEMO_READINESS_TEST === "1";
const skipReason =
  "Set DEMO_READINESS_TEST=1 and point PLAYWRIGHT_BASE_URL at test Shop (https://test-shop.lax.bid).";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir =
  process.env.DEMO_READINESS_EVIDENCE_DIR ??
  join(repoRoot, "docs/evidence/demo-readiness-test/screenshots");

const bidBase = (process.env.BID_WEB_ORIGIN ?? "https://test.lax.bid").replace(/\/+$/, "");
const shopBase = (process.env.PLAYWRIGHT_BASE_URL ?? "https://test-shop.lax.bid").replace(
  /\/+$/,
  "",
);
const shopOrigin = new URL(shopBase).origin;
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const backupEmail = process.env.IDENTITY_ACCEPTANCE_EMAIL ?? process.env.SHOP_OIDC_TEST_EMAIL;
const backupPassword =
  process.env.IDENTITY_ACCEPTANCE_PASSWORD ?? process.env.SHOP_OIDC_TEST_PASSWORD;

const harborSlug = "harbor-print";

function isShopCheckoutUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.hostname.includes("test-shop") && url.pathname.startsWith("/checkout");
  } catch {
    return false;
  }
}

function shot(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  return page.screenshot({
    path: join(evidenceDir, `${name}.png`),
    fullPage: true,
  });
}

async function dismissCookieConsentIfPresent(page: Page) {
  const accept = page.getByRole("button", { name: /Accept all/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function hostedAuthSignIn(page: Page, email: string, password: string) {
  const loginForm = page.locator("#login-form");
  await loginForm.locator("#email").fill(email);
  await loginForm.getByRole("button", { name: "Continue" }).click();
  await expect(loginForm.locator("#password")).toBeVisible({ timeout: 30_000 });
  await loginForm.locator("#password").fill(password);
  await loginForm.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/test-auth\.lax\.bid\/login/, { timeout: 120_000 });
}

async function shopInteractiveSignIn(page: Page, email: string, password: string) {
  if (!page.url().startsWith(shopOrigin)) {
    await page.goto(`${shopBase}/`);
  }
  await dismissCookieConsentIfPresent(page);
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  if (await accountMenu.isVisible().catch(() => false)) {
    return;
  }
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("link", { name: "Sign in" }).click();
  } else {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign in" }).click();
  }
  const hostedLogin = page.waitForURL(
    (url) => url.origin === authBase && url.pathname === "/login",
    { timeout: 90_000 },
  );
  const silentShopSignIn = accountMenu.waitFor({ state: "visible", timeout: 90_000 });
  await Promise.race([hostedLogin, silentShopSignIn]);
  if (new URL(page.url()).origin === authBase) {
    await hostedAuthSignIn(page, email, password);
    await expect(page).toHaveURL((url) => url.origin !== authBase, { timeout: 120_000 });
  }
  await expect(accountMenu).toBeVisible({ timeout: 60_000 });
}

async function bidInteractiveSignIn(page: Page, email: string, password: string) {
  const bidOrigin = new URL(bidBase).origin;
  await page.goto(`${bidBase}/login?next=${encodeURIComponent("/dashboard")}`);
  await page.waitForURL((url) => url.origin === authBase || url.origin === bidOrigin, {
    timeout: 120_000,
  });
  if (new URL(page.url()).origin === authBase) {
    await hostedAuthSignIn(page, email, password);
    await page.waitForURL((url) => url.origin === bidOrigin, { timeout: 120_000 });
  }
  await dismissCookieConsentIfPresent(page);
  await expect(page).toHaveURL((url) => url.origin === bidOrigin && url.pathname !== "/login");
}

async function addHarborPrintToBasket(page: Page) {
  await page.goto(`/artworks/${harborSlug}`);
  await dismissCookieConsentIfPresent(page);
  const addButton = page.getByRole("button", { name: /add to basket/i });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${shopBase}/commerce/basket`);
        if (!response.ok()) return 0;
        const body = (await response.json()) as { lines?: unknown[] };
        return body.lines?.length ?? 0;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
}

async function shopSignOut(page: Page) {
  await page.goto(`${shopBase}/`);
  await dismissCookieConsentIfPresent(page);
  const notice = page.getByRole("dialog", { name: "You're signed in" });
  if (await notice.isVisible().catch(() => false)) {
    await notice.getByRole("button", { name: "Continue" }).click();
    await expect(notice).toBeHidden({ timeout: 15_000 });
  }
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await page.getByRole("button", { name: "Sign out" }).click();
    return;
  }
  const logoutForm = page.locator('form[action$="/logout"][method="post"]').first();
  await logoutForm.evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
  });
  await page.waitForLoadState("networkidle");
}

async function ensureAuthenticatedCheckout(page: Page, email: string, password: string) {
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  if (!(await accountMenu.isVisible().catch(() => false))) {
    await shopInteractiveSignIn(page, email, password);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/checkout");
    await page.waitForURL(
      (url) =>
        (url.origin === shopOrigin && url.pathname.startsWith("/checkout")) ||
        (url.origin === new URL(authBase).origin && url.pathname === "/login"),
      { timeout: 60_000 },
    );
    while (new URL(page.url()).origin === new URL(authBase).origin) {
      await hostedAuthSignIn(page, email, password);
      await page.waitForURL(
        (url) => url.origin === shopOrigin && !url.pathname.startsWith("/auth/"),
        { timeout: 120_000 },
      );
      await page.goto(`${shopBase}/account/post-sign-in`);
      await page.waitForURL(/\/account/, { timeout: 60_000 });
      await page.goto("/checkout");
      await page.waitForURL(
        (url) =>
          (url.origin === shopOrigin && url.pathname.startsWith("/checkout")) ||
          (url.origin === new URL(authBase).origin && url.pathname === "/login"),
        { timeout: 60_000 },
      );
    }
    if (!isShopCheckoutUrl(page.url())) {
      throw new Error(`Expected Shop /checkout after sign-in, got ${page.url()}`);
    }
    const checkoutUnavailable = page.getByRole("heading", { name: "Checkout unavailable" });
    if (await checkoutUnavailable.isVisible().catch(() => false)) {
      throw new Error(
        "Checkout unavailable on test Shop — basket could not be loaded for the signed-in session",
      );
    }
    if (
      await page
        .getByLabel("Address line 1")
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
  }
  const snippet = await page
    .locator("[data-testid=shop-commerce-content], main")
    .first()
    .textContent();
  throw new Error(
    `Checkout delivery form missing at ${page.url()}: ${(snippet ?? "").replace(/\s+/g, " ").slice(0, 500)}`,
  );
}

function deriveRehearsalSignupEmail(sourceEmail: string, stamp: number): string {
  const normalized = sourceEmail.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1) {
    throw new Error("IDENTITY_ACCEPTANCE_EMAIL must be a valid address for Postmark sign-up proof");
  }
  const local = normalized.slice(0, at).split("+")[0];
  const domain = normalized.slice(at + 1);
  return `${local}+demo-rehearsal-${stamp}@${domain}`;
}

async function signUpViaIssuer(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const response = await request.post(`${authBase}/api/auth/sign-up/email`, {
    headers: {
      "content-type": "application/json",
      origin: authBase,
    },
    data: {
      email,
      password,
      name: "Demo rehearsal sign-up",
    },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Issuer sign-up failed (${response.status()}): ${body.slice(0, 400)}`);
  }
}

function waitForPostmarkVerificationLink(recipient: string): string {
  return execFileSync(process.execPath, ["scripts/ci/postmark-wait-verification-link.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      POSTMARK_RECIPIENT: recipient,
    },
    encoding: "utf8",
    timeout: 190_000,
  }).trim();
}

async function completeStripeCheckout(page: Page, payerEmail: string) {
  if (!page.url().includes("checkout.stripe.com")) {
    throw new Error(`Expected Stripe Hosted Checkout, got ${page.url()}`);
  }
  await shot(page, "03-stripe-checkout");

  const emailField = page
    .getByPlaceholder(/email/i)
    .or(page.locator('input[type="email"], input[name="email"]'))
    .first();
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(payerEmail);
  }

  const cardByPlaceholder = page.getByPlaceholder(/1234 1234 1234 1234|card number/i).first();
  if (await cardByPlaceholder.isVisible().catch(() => false)) {
    await cardByPlaceholder.fill("4242424242424242");
    const expiry = page.getByPlaceholder(/MM \/ YY|MM\/YY/i).first();
    if (await expiry.isVisible()) {
      await expiry.fill("12 / 34");
    }
    const cvc = page.getByPlaceholder(/CVC|cvc/i).first();
    if (await cvc.isVisible()) {
      await cvc.fill("123");
    }
  } else {
    const cardFrame = page.frameLocator('iframe[src*="stripe"]').first();
    const card = cardFrame
      .locator('input[name="cardnumber"], input[autocomplete="cc-number"]')
      .first();
    await card.waitFor({ state: "visible", timeout: 60_000 });
    await card.fill("4242424242424242");
    const expiry = cardFrame
      .locator('input[name="exp-date"], input[autocomplete="cc-exp"]')
      .first();
    if (await expiry.isVisible()) {
      await expiry.fill("12 / 34");
    }
    const cvc = cardFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').first();
    if (await cvc.isVisible()) {
      await cvc.fill("123");
    }
  }

  const billingName = page.locator('input[name="billingName"]').first();
  if (await billingName.isVisible()) {
    await billingName.fill("Demo Rehearsal");
  }

  const payButton = page.getByRole("button", { name: /^Pay|^Submit|^Complete order/i }).first();
  await payButton.click();
  await page.waitForURL(
    (url) => url.origin === shopOrigin && url.pathname.includes("/checkout/confirmation"),
    { timeout: 180_000 },
  );
}

test.describe("demo readiness (test) @demo-readiness", () => {
  test.setTimeout(180_000);

  test("01 Postmark sign-up email lands verification back on Shop", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !process.env.POSTMARK_SERVER_TOKEN,
      "POSTMARK_SERVER_TOKEN required to fetch verification email",
    );
    test.skip(!backupEmail, "IDENTITY_ACCEPTANCE_EMAIL required for deliverable Postmark proof");

    const stamp = Date.now();
    const email = deriveRehearsalSignupEmail(backupEmail as string, stamp);
    const password = process.env.DEMO_REHEARSAL_PASSWORD ?? `Demo-${stamp}-Aa1!`;

    await signUpViaIssuer(request, email, password);
    await shot(page, "01-sign-up-submitted");

    const verifyLink = waitForPostmarkVerificationLink(email);
    await page.goto(verifyLink);
    await page.waitForLoadState("networkidle");
    await shot(page, "01-postmark-verification-landing");

    expect(page.url()).toMatch(/test-shop\.lax\.bid|test-auth\.lax\.bid|test\.lax\.bid/);
  });

  test("02 Bid sign-in then Shop recognizes the issuer session", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );

    await bidInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    await shot(page, "02-bid-signed-in");

    await page.goto(`${shopBase}/`);
    await dismissCookieConsentIfPresent(page);
    const notice = page.getByRole("dialog", { name: "You're signed in" });
    if (await notice.isVisible().catch(() => false)) {
      await shot(page, "02-shop-silent-sso-notice-modal");
      await notice.getByRole("button", { name: "Continue" }).click();
      await expect(notice).toBeHidden({ timeout: 15_000 });
      return;
    }

    const accountMenu = page.getByRole("button", { name: "Account menu" });
    const signedInAfterBid = await accountMenu
      .waitFor({ state: "visible", timeout: 120_000 })
      .then(() => true)
      .catch(() => false);
    if (!signedInAfterBid) {
      await shopInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    }
    await expect(accountMenu).toBeVisible({ timeout: 60_000 });
    await shot(page, "02-shop-signed-in-after-bid");
  });

  test("03 Harbor Print checkout with 4242 reaches paid", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );
    test.setTimeout(300_000);

    await shopInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    await addHarborPrintToBasket(page);
    await shot(page, "03-basket-with-line");

    await ensureAuthenticatedCheckout(page, backupEmail as string, backupPassword as string);
    await page.getByLabel("Address line 1").fill("1 Demo Street");
    await page.getByLabel("City").fill("London");
    await page.getByLabel("Postcode").fill("W1A 1AA");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    const stripeOrConfirmation = page.waitForURL(/checkout\.stripe\.com|\/checkout\/confirmation/, {
      timeout: 180_000,
    });
    const checkoutBlocked = page
      .getByRole("alert")
      .filter({ hasText: /.+/ })
      .waitFor({ state: "visible", timeout: 180_000 })
      .then(async () => {
        throw new Error(
          `Checkout blocked: ${(await page.getByRole("alert").first().textContent()) ?? "unknown"}`,
        );
      });
    await Promise.race([stripeOrConfirmation, checkoutBlocked]);
    if (!page.url().includes("/checkout/confirmation")) {
      await completeStripeCheckout(page, backupEmail as string);
    }
    await expect(page).toHaveURL(/checkout\/confirmation/, { timeout: 30_000 });

    const thankYou = page.getByRole("heading", { name: /thank you|payment processing/i });
    await expect(thankYou).toBeVisible({ timeout: 30_000 });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const paidHeading = page.getByRole("heading", { name: "Thank you" });
      if (await paidHeading.isVisible()) {
        await shot(page, "03-checkout-paid");
        return;
      }
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    await shot(page, "03-checkout-final-state");
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  });

  test("04 Shop logout then Bid is signed out", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );

    await shopInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    await bidInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    await shot(page, "04-bid-before-logout");

    await shopSignOut(page);

    await page.waitForTimeout(5_000);
    await shot(page, "04-shop-after-logout");

    await page.goto(`${bidBase}/dashboard`);
    await page.waitForLoadState("networkidle");
    await shot(page, "04-bid-after-shop-logout");

    const onHostedLogin = /\/login|test-auth\.lax\.bid/.test(page.url());
    const bidLogout = page.getByRole("button", { name: "Log out" });
    const stillSignedInOnBid = !onHostedLogin && (await bidLogout.isVisible().catch(() => false));
    expect(
      stillSignedInOnBid,
      "Shop logout should end the Bid BFF session (back-channel logout); dashboard still shows Log out",
    ).toBe(false);
  });
});
