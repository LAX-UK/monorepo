import type { Page } from "@playwright/test";

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
    (url) => url.pathname === returnTo || url.pathname.startsWith("/account/post-sign-in"),
    { timeout: 60_000 },
  );
  if (page.url().includes("/account/post-sign-in")) {
    await page.waitForURL((url) => url.pathname === returnTo || url.pathname.startsWith(returnTo), {
      timeout: 60_000,
    });
  }
}

export async function signOutShopBuyer(page: Page): Promise<void> {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  const signOut = page.getByRole("button", { name: "Sign out" });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/signed-out" || url.pathname === "/", {
      timeout: 90_000,
    }),
    signOut.click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
}
