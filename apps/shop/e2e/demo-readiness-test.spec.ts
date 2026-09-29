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

async function assertHealthyBasket(page: Page) {
  const basketHeading = page.getByRole("heading", { name: "Basket", exact: true });
  const unavailable = page.getByRole("heading", { name: "Basket unavailable" });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await basketHeading.isVisible().catch(() => false)) {
      await expect(page.locator(".shop-basket__line").first()).toBeVisible();
      return;
    }
    if (
      (await unavailable.isVisible().catch(() => false)) ||
      (await page
        .getByRole("heading", { name: "Basket temporarily unavailable" })
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByRole("button", { name: "Try again" }).click();
      await page.waitForLoadState("domcontentloaded");
      continue;
    }
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  }
  await expect(basketHeading).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".shop-basket__line").first()).toBeVisible();
}

async function addHarborPrintToBasket(page: Page) {
  await page.goto(`/artworks/${harborSlug}`);
  await dismissCookieConsentIfPresent(page);
  const addButton = page.getByRole("button", { name: /add to basket/i });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await page.waitForURL("**/basket**", { timeout: 60_000 });
  await assertHealthyBasket(page);
}

async function ensureAuthenticatedCheckout(page: Page, email: string, password: string) {
  const proceed = page.getByRole("link", { name: /proceed to checkout/i });
  if (await proceed.isVisible().catch(() => false)) {
    await proceed.click();
  } else {
    await page.goto("/checkout");
  }
  await page.waitForURL(/\/checkout|\/login|test-auth/, { timeout: 60_000 });
  if (page.url().includes("test-auth") && page.url().includes("/login")) {
    await hostedAuthSignIn(page, email, password);
    await page.waitForURL(/test-shop\.lax\.bid\/checkout/, { timeout: 120_000 });
  } else if (!page.url().includes("/checkout")) {
    await shopInteractiveSignIn(page, email, password);
    await page.goto("/checkout");
  }
  await expect(page).toHaveURL(/\/checkout/, { timeout: 60_000 });
  await expect(page.getByLabel("Address line 1")).toBeVisible({ timeout: 60_000 });
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
  await page.waitForURL(/test-shop\.lax\.bid.*\/checkout\/confirmation/, { timeout: 180_000 });
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

  test("03 Harbor Print checkout with 4242 reaches paid", async ({ page, context }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );
    test.setTimeout(300_000);

    await context.clearCookies();
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

    await page.goto(`${shopBase}/`);
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) {
      await menu.click();
      await page.getByRole("button", { name: "Sign out" }).click();
    } else {
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
    }

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
