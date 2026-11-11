import type { BrowserContext, Page } from "@playwright/test";
import { forgetSignIn, rememberSignIn } from "../../../../scripts/ci/e2e-sign-out.mjs";

export type ShopBuyerCredentials = {
  email: string;
  password: string;
};

export async function signInShopBuyer(
  page: Page,
  credentials: ShopBuyerCredentials,
  returnTo = "/checkout",
): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });

  const continueToCredentials = page.getByRole("button", { name: /^continue$/i });
  const password = page
    .locator('input[name="password"], input[autocomplete="current-password"]')
    .first();
  const email = page.locator('#email, input[name="email"], input[type="email"]').first();

  await Promise.race([
    continueToCredentials.waitFor({ state: "visible", timeout: 45_000 }),
    password.waitFor({ state: "visible", timeout: 45_000 }),
    email.waitFor({ state: "visible", timeout: 45_000 }),
  ]).catch(() => {});

  if (await email.isVisible().catch(() => false)) {
    await email.fill(credentials.email);
  }

  if (await continueToCredentials.isVisible().catch(() => false)) {
    await continueToCredentials.click();
  }

  await password.waitFor({ state: "visible", timeout: 45_000 });
  await password.fill(credentials.password);

  const submit = page.getByRole("button", { name: /^sign in$/i });
  if (await submit.isVisible().catch(() => false)) {
    await submit.click();
  } else {
    await page
      .getByRole("button", { name: /sign in|log in|continue/i })
      .first()
      .click();
  }

  await page.waitForURL(
    (url) => url.pathname.startsWith(returnTo) || url.pathname.startsWith("/account/post-sign-in"),
    { timeout: 60_000 },
  );
  if (page.url().includes("/account/post-sign-in")) {
    await page.waitForURL((url) => url.pathname === returnTo || url.pathname.startsWith(returnTo), {
      timeout: 60_000,
    });
  }
  // The spec fixture signs this browser out when the spec ends.
  rememberSignIn(page.context(), signOutContextThroughMenu);
}

export async function signOutShopBuyer(page: Page): Promise<void> {
  await page.goto("/account/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Account menu" }).click();
  const signOut = page.getByRole("menuitem", { name: "Sign out" });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/signed-out" || url.pathname === "/", {
      timeout: 90_000,
    }),
    signOut.click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  forgetSignIn(page.context());
}

/** Signs a signed-in browser out from a desktop-sized page, whatever size the spec ran at. */
async function signOutContextThroughMenu(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signOutShopBuyer(page);
  } finally {
    await page.close();
  }
}
