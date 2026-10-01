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
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForLoadState("networkidle");

  const email = page.locator("#email");
  if (await email.isVisible().catch(() => false)) {
    await email.fill(credentials.email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator("#password").fill(credentials.password);
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
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/signed-out" || url.pathname === "/", {
    timeout: 60_000,
  });
}
