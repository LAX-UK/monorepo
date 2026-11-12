import { type BrowserContext, type Page, expect } from "@playwright/test";
import { forgetSignIn, rememberSignIn } from "../../../../scripts/ci/e2e-sign-out.mjs";

export const artE2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const artE2eSkipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3050), and start the Art stack (scripts/local/start-shop-stack.sh).";

export type ArtBuyerCredentials = { email: string; password: string };

/** Seeded buyer for favorites journeys; tests skip when unset. */
export function artBuyerCredentials(): ArtBuyerCredentials | null {
  const email = process.env.ART_E2E_BUYER_EMAIL?.trim();
  const password = process.env.ART_E2E_BUYER_PASSWORD;
  return email && password ? { email, password } : null;
}

export async function signInArtBuyer(
  page: Page,
  credentials: ArtBuyerCredentials,
  returnTo: string,
): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
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
  await password.waitFor({ state: "visible", timeout: 45_000 });
  await password.fill(credentials.password);
  await page
    .getByRole("button", { name: /sign in|log in|continue/i })
    .first()
    .click();
  await page.waitForURL((url) => url.pathname.startsWith(returnTo.split("?")[0] ?? returnTo), {
    timeout: 60_000,
  });
  // The spec fixture signs this browser out when the spec ends.
  rememberSignIn(page.context(), signOutContextThroughMenu);
}

/** Signs out through the account menu, so the sign-in service ends the session too. */
export async function signOutArtBuyer(page: Page): Promise<void> {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Account menu" }).filter({ visible: true }).click();
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/signed-out" || url.pathname === "/", {
      timeout: 90_000,
    }),
    page.getByRole("menuitem", { name: "Sign out" }).click(),
  ]);
  forgetSignIn(page.context());
}

/** Signs a signed-in browser out from a desktop-sized page, whatever size the spec ran at. */
async function signOutContextThroughMenu(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signOutArtBuyer(page);
  } finally {
    await page.close();
  }
}

/**
 * Guarded routes stream behind `loading.tsx`, so `redirect()` arrives in the RSC stream (HTTP 200)
 * rather than as a 307; assert where the browser lands instead of the status code.
 */
export async function expectSignInRedirect(
  page: Page,
  path: string,
  returnTo: string,
): Promise<void> {
  const loginRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/login",
    {
      timeout: 45_000,
    },
  );
  await page.goto(path);
  const loginUrl = new URL((await loginRequest).url());
  expect(loginUrl.searchParams.get("returnTo")).toBe(returnTo);
}

/** First catalogue card on /artworks, or null when the art channel has no published works. */
export async function firstArtworkHref(page: Page): Promise<string | null> {
  await page.goto("/artworks");
  const firstTitle = page
    .getByTestId("art-artwork-card")
    .first()
    .getByRole("heading")
    .getByRole("link");
  if ((await firstTitle.count()) === 0) return null;
  return firstTitle.getAttribute("href");
}
