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
  await input.page.goto(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  await input.page.waitForURL(/\/auth\/|test-auth\.lax\.bid/, { timeout: 60_000 });
  await input.page.getByLabel(/email/i).fill(input.email);
  await input.page.getByLabel(/password/i).fill(input.password);
  await input.page.getByRole("button", { name: /sign in|continue|log in/i }).click();
  if (input.totpSecret) {
    const totp = new TOTP({ secret: input.totpSecret });
    const code = totp.generate();
    const otpField = input.page.getByLabel(/authenticator|verification|code/i);
    await otpField.waitFor({ timeout: 30_000 });
    await otpField.fill(code);
    await input.page.getByRole("button", { name: /verify|continue|submit/i }).click();
  }
  await input.page.waitForURL(/test-shop-admin\.lax\.bid|localhost:3030/, { timeout: 120_000 });
}
