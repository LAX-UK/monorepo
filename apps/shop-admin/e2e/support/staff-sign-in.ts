import type { Page } from "@playwright/test";
import { TOTP } from "otpauth";

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
    throw new Error(
      `staff hosted login did not reach password step (url=${input.page.url()}): ${error instanceof Error ? error.message : String(error)}`,
    );
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

  const authorize = input.page.getByRole("button", { name: /authorize|allow|continue/i });
  if (await authorize.isVisible().catch(() => false)) {
    await authorize.click();
  }

  await input.page.waitForURL(/test-shop-admin\.lax\.bid|localhost:3030/, { timeout: 120_000 });
}
