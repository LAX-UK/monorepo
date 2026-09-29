import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

const enabled = process.env.DEMO_READINESS_TEST === "1";
const skipReason =
  "Set DEMO_READINESS_TEST=1 and point PLAYWRIGHT_BASE_URL at test Shop (https://test-shop.lax.bid).";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir =
  process.env.DEMO_READINESS_EVIDENCE_DIR ??
  join(repoRoot, "docs/evidence/demo-readiness-test/screenshots");

const bidBase = (process.env.BID_WEB_ORIGIN ?? "https://test.lax.bid").replace(/\/+$/, "");
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

async function hostedAuthSignIn(page: Page, email: string, password: string) {
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#password")).toBeVisible({ timeout: 30_000 });
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

async function shopInteractiveSignIn(page: Page, email: string, password: string) {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("link", { name: "Sign in" }).click();
  } else {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign in" }).click();
  }
  await expect(page).toHaveURL((url) => url.origin === authBase && url.pathname === "/login", {
    timeout: 60_000,
  });
  await hostedAuthSignIn(page, email, password);
  await expect(page).toHaveURL((url) => url.origin !== authBase, { timeout: 120_000 });
}

async function bidInteractiveSignIn(page: Page, email: string, password: string) {
  await page.goto(`${bidBase}/login?next=${encodeURIComponent("/dashboard")}`);
  await expect(page).toHaveURL((url) => url.origin === authBase, { timeout: 60_000 });
  await hostedAuthSignIn(page, email, password);
  await page.waitForURL((url) => url.origin === new URL(bidBase).origin, { timeout: 120_000 });
}

function waitForPostmarkVerificationLink(recipient: string): string {
  return execFileSync(process.execPath, ["scripts/ci/postmark-wait-verification-link.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      POSTMARK_RECIPIENT: recipient,
    },
    encoding: "utf8",
    timeout: 130_000,
  }).trim();
}

async function completeStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 120_000 });
  await shot(page, "03-stripe-checkout");

  const card = page.locator('input[name="cardNumber"], input[autocomplete="cc-number"]').first();
  await card.waitFor({ state: "visible", timeout: 60_000 });
  await card.fill("4242424242424242");

  const expiry = page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]').first();
  if (await expiry.isVisible()) {
    await expiry.fill("12/34");
  }

  const cvc = page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first();
  if (await cvc.isVisible()) {
    await cvc.fill("123");
  }

  const billingName = page.locator('input[name="billingName"]').first();
  if (await billingName.isVisible()) {
    await billingName.fill("Demo Rehearsal");
  }

  const payButton = page.getByRole("button", { name: /pay|submit|complete/i }).first();
  await payButton.click();
}

test.describe("demo readiness (test) @demo-readiness", () => {
  test.describe.configure({ mode: "serial" });

  test("01 Postmark sign-up email lands verification back on Shop", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !process.env.POSTMARK_SERVER_TOKEN,
      "POSTMARK_SERVER_TOKEN required to fetch verification email",
    );

    const stamp = Date.now();
    const email = `lax.demo.rehearsal+demo${stamp}@example.com`;
    const password = process.env.DEMO_REHEARSAL_PASSWORD ?? `Demo-${stamp}-Aa1!`;

    await page.goto("/register");
    await expect(page).toHaveURL(
      (url) => url.pathname === "/register" || url.pathname === "/login",
      {
        timeout: 60_000,
      },
    );
    if (new URL(page.url()).origin === authBase) {
      await page
        .getByRole("link", { name: /create an account|sign up|register/i })
        .first()
        .click();
    }

    await expect(page.locator("#email")).toBeVisible({ timeout: 60_000 });
    await page.locator("#email").fill(email);
    await page.getByRole("button", { name: /continue|next/i }).click();

    const passwordField = page.locator("#password");
    if (await passwordField.isVisible()) {
      await passwordField.fill(password);
      const confirm = page.locator("#confirmPassword, #password-confirm");
      if (await confirm.isVisible()) {
        await confirm.fill(password);
      }
      await page.getByRole("button", { name: /sign up|create account|register/i }).click();
    }

    await shot(page, "01-sign-up-submitted");

    const verifyLink = waitForPostmarkVerificationLink(email);
    await page.goto(verifyLink);
    await page.waitForLoadState("networkidle");
    await shot(page, "01-postmark-verification-landing");

    expect(page.url()).toMatch(/test-shop\.lax\.bid|test-auth\.lax\.bid|test\.lax\.bid/);
  });

  test("02 Bid sign-in then Shop silent SSO shows notice modal", async ({ browser }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );

    const bidContext = await browser.newContext();
    const shopContext = await browser.newContext();
    const bidPage = await bidContext.newPage();
    const shopPage = await shopContext.newPage();

    await bidInteractiveSignIn(bidPage, backupEmail as string, backupPassword as string);
    await shot(bidPage, "02-bid-signed-in");

    await shopPage.goto("https://test-shop.lax.bid/");
    const notice = shopPage.getByRole("dialog", { name: "You're signed in" });
    await expect(notice).toBeVisible({ timeout: 120_000 });
    await shot(shopPage, "02-shop-silent-sso-notice-modal");
    await shopPage.getByRole("button", { name: "Continue" }).click();
    await expect(notice).toBeHidden({ timeout: 15_000 });

    await bidContext.close();
    await shopContext.close();
  });

  test("03 Harbor Print checkout with 4242 reaches paid", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );

    await shopInteractiveSignIn(page, backupEmail as string, backupPassword as string);
    await page.goto(`/artworks/${harborSlug}`);
    await page.getByRole("button", { name: /add to basket/i }).click();
    await page.waitForURL("**/basket**", { timeout: 60_000 });
    await shot(page, "03-basket-with-line");

    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 60_000 });
    await page.getByRole("button", { name: /pay|continue|place order/i }).click();

    await completeStripeCheckout(page);
    await page.waitForURL(/checkout\/confirmation/, { timeout: 180_000 });

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

  test("04 Shop logout then Bid is signed out", async ({ browser }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop evidence only");
    test.skip(
      !backupEmail || !backupPassword,
      "IDENTITY_ACCEPTANCE_* or SHOP_OIDC_* credentials required",
    );

    const shopContext = await browser.newContext();
    const bidContext = await browser.newContext();
    const shopPage = await shopContext.newPage();
    const bidPage = await bidContext.newPage();

    await shopInteractiveSignIn(shopPage, backupEmail as string, backupPassword as string);
    await bidInteractiveSignIn(bidPage, backupEmail as string, backupPassword as string);
    await shot(bidPage, "04-bid-before-logout");

    await shopPage.goto("/");
    const menu = shopPage.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) {
      await menu.click();
      await shopPage.getByRole("button", { name: "Sign out" }).click();
    } else {
      await shopPage.getByRole("button", { name: "Account menu" }).click();
      await shopPage.getByRole("menuitem", { name: "Sign out" }).click();
    }

    await shopPage.waitForTimeout(5_000);
    await shot(shopPage, "04-shop-after-logout");

    await bidPage.goto(`${bidBase}/dashboard`);
    await bidPage.waitForLoadState("networkidle");
    await shot(bidPage, "04-bid-after-shop-logout");
    expect(bidPage.url()).toMatch(/\/login|test-auth\.lax\.bid/);

    await shopContext.close();
    await bidContext.close();
  });
});
