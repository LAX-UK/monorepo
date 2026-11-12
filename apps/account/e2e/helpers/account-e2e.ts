import { type Page, expect } from "@playwright/test";

export const accountE2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const accountE2eSkipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3040) and start the Account stack (auth, api, shop-api, account).";

function accountPort(): string {
  return new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3040").port;
}

const PASSWORD_STEP_TIMEOUT_MS = 10_000;

export type AccountCredentials = { email: string; password: string };

/** Demo collector (Charlotte Hayes): Bid works from the demo seed, one Shop edition from CI. */
export function collectorCredentials(): AccountCredentials | null {
  const email = process.env.ACCOUNT_E2E_COLLECTOR_EMAIL?.trim();
  const password = process.env.ACCOUNT_E2E_COLLECTOR_PASSWORD;
  return email && password ? { email, password } : null;
}

/** A seeded person with no works, payments or alerts in any product. */
export function newPersonCredentials(): AccountCredentials | null {
  const email = process.env.ACCOUNT_E2E_EMPTY_EMAIL?.trim();
  const password = process.env.ACCOUNT_E2E_EMPTY_PASSWORD;
  return email && password ? { email, password } : null;
}

/**
 * A seeded person only the signed-in devices journeys use. They sign in from several browsers and
 * sign others out, which would end the sessions other specs reuse, so no other spec shares them.
 */
export function devicesPersonCredentials(): AccountCredentials | null {
  const email = process.env.ACCOUNT_E2E_DEVICES_EMAIL?.trim();
  const password = process.env.ACCOUNT_E2E_DEVICES_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Why the collector journeys cannot run here, or null when they can. */
export function collectorSkipReason(): string | null {
  if (!accountE2eEnabled) return accountE2eSkipReason;
  return collectorCredentials() ? null : "ACCOUNT_E2E_COLLECTOR_EMAIL / _PASSWORD not set";
}

/** Why the no-data journeys cannot run here, or null when they can. */
export function newPersonSkipReason(): string | null {
  if (!accountE2eEnabled) return accountE2eSkipReason;
  return newPersonCredentials() ? null : "ACCOUNT_E2E_EMPTY_EMAIL / _PASSWORD not set";
}

/** Why the signed-in devices journeys cannot run here, or null when they can. */
export function devicesPersonSkipReason(): string | null {
  if (!accountE2eEnabled) return accountE2eSkipReason;
  return devicesPersonCredentials() ? null : "ACCOUNT_E2E_DEVICES_EMAIL / _PASSWORD not set";
}

/**
 * Signs in through Account's own login route, which hands off to the hosted sign-in on apps/auth
 * (the same email, Continue, password steps the Art helper drives), then waits for `returnTo`.
 */
export async function signInAccount(
  page: Page,
  credentials: AccountCredentials,
  returnTo = "/account",
  { stepUp = false }: { stepUp?: boolean } = {},
): Promise<void> {
  // `intent=reauth` is the "Confirm it's you" link: a fresh sign-in for someone already signed in.
  const intent = stepUp ? "&intent=reauth" : "";
  await page.goto(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}${intent}`, {
    waitUntil: "domcontentloaded",
  });
  const email = page.locator('#email, input[name="email"], input[type="email"]').first();
  const password = page
    .locator('input[name="password"], input[autocomplete="current-password"]')
    .first();
  const continueButton = page.getByRole("button", { name: /^continue$/i });

  await Promise.race([
    email.waitFor({ state: "visible", timeout: 45_000 }),
    password.waitFor({ state: "visible", timeout: 45_000 }),
  ]).catch(() => {});
  if (await email.isVisible().catch(() => false)) await email.fill(credentials.email);
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
  // The password step follows Continue at once; if it does not, say where sign-in stopped.
  await password.waitFor({ state: "visible", timeout: PASSWORD_STEP_TIMEOUT_MS }).catch(() => {
    throw new Error(
      `Sign-in for ${credentials.email} never reached the password step (stopped at ${page.url()}). Check the person has a password and is not held at a verification or onboarding step.`,
    );
  });
  await password.fill(credentials.password);
  await page
    .getByRole("button", { name: /sign in|log in|continue/i })
    .first()
    .click();
  const path = returnTo.split("?")[0] ?? returnTo;
  await page.waitForURL((url) => url.pathname === path && url.port === accountPort(), {
    timeout: 60_000,
  });
}

/** Collects console errors and uncaught page errors; assert the list is empty at the end. */
export function trackConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => errors;
}

export async function expectPageHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}
