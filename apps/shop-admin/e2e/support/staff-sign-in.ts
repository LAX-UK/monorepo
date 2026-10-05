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
  if (await continueToCredentials.isVisible().catch(() => false)) {
    await continueToCredentials.click();
  }

  await passwordField.waitFor({ state: "visible", timeout: 45_000 });
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
    const totp = new TOTP({ secret: input.totpSecret });
    const code = totp.generate();
    const otpField = input.page.getByLabel(/authenticator|verification|code/i);
    await otpField.waitFor({ timeout: 30_000 });
    await otpField.fill(code);
    await input.page.getByRole("button", { name: /verify|continue|submit/i }).click();
  }

  const authorize = input.page.getByRole("button", { name: /authorize|allow|continue/i });
  if (await authorize.isVisible().catch(() => false)) {
    await authorize.click();
  }

  await input.page.waitForURL(/test-shop-admin\.lax\.bid|localhost:3030/, { timeout: 120_000 });
}
