import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and start Shop (:3020), shop-identity (:3010), and auth (:3003).";
const issuerOrigin = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");

async function openHostedLogin(page: Page): Promise<void> {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click();
    const mobileSignIn = page.getByRole("link", { name: "Sign in" });
    await mobileSignIn.click();
    await expect(page).toHaveURL((url) => url.origin === issuerOrigin && url.pathname === "/login");
    return;
  }
  await page.getByRole("button", { name: "Account menu" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Sign in" }).filter({ visible: true }).click();
  await expect(page).toHaveURL((url) => url.origin === issuerOrigin && url.pathname === "/login");
}

async function expectNoBlockingAxe(page: Page): Promise<void> {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = axe.violations.filter((v) =>
    ["critical", "serious", "moderate"].includes(v.impact ?? ""),
  );
  expect(blocking).toEqual([]);
}

test.describe("Shop hosted authentication @a11y", () => {
  test("email, credentials, and magic-link-sent steps are keyboard operable and axe-clean", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHostedLogin(page);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authorize LAX Shop Web" })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "LAX Shop" })).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator('[data-login-step="email"]')).toBeVisible();

    await page.locator("#email").focus();
    await expect(page.locator("#email")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
    await expectNoBlockingAxe(page);

    await page.locator("#email").fill("buyer@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#password")).toBeFocused();
    await expect(page.locator('[data-login-step="credentials"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authorize LAX Shop Web" })).toHaveCount(0);
    await expectNoBlockingAxe(page);

    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.locator('[data-login-step="magic-link-sent"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Resend sign-in link|Wait 30s to resend/ }),
    ).toBeVisible();
    await expectNoBlockingAxe(page);
  });

  test("password sign-in and an existing issuer session skip Authorize LAX Shop Web", async ({
    page,
  }) => {
    const email = process.env.SHOP_OIDC_TEST_EMAIL;
    const password = process.env.SHOP_OIDC_TEST_PASSWORD;
    test.skip(
      !enabled || !email || !password,
      `${skipReason} Provide SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD.`,
    );
    await openHostedLogin(page);
    await page.locator("#email").fill(email as string);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#password")).toBeVisible();
    await page.locator("#password").fill(password as string);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL((url) => url.origin !== issuerOrigin, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Authorize LAX Shop Web" })).toHaveCount(0);
    expect(page.url()).not.toMatch(/\/oauth2\/consent/);

    const shopIdentity = (process.env.SHOP_IDENTITY_BASE_URL ?? "http://localhost:3010").replace(
      /\/+$/,
      "",
    );
    await page.goto(`${shopIdentity}/login`);
    await expect(page).toHaveURL((url) => url.origin !== issuerOrigin, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Authorize LAX Shop Web" })).toHaveCount(0);
    expect(page.url()).not.toMatch(/\/oauth2\/consent/);
  });

  test("recovery links keep the Shop client_id", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await openHostedLogin(page);
    await page.locator("#email").fill("buyer@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#password")).toBeFocused();
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    expect(new URL(page.url()).searchParams.get("client_id")).toBe("lax-shop-web");
    await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  });

  test("hosted login screenshots in light and dark across email and credentials", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await openHostedLogin(page);
    await expect(page).toHaveScreenshot("shop-hosted-login-light.png");
    await page.locator("#email").fill("buyer@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page).toHaveScreenshot("shop-hosted-login-credentials-light.png");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page).toHaveScreenshot("shop-hosted-login-credentials-dark.png");
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page).toHaveScreenshot("shop-hosted-login-dark.png");
  });
});
