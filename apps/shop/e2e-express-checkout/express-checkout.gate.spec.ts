import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

/**
 * GAP-49 wallet row on the basket and Details, with Stripe.js and Shop Identity replaced by
 * stand-ins (see playwright.express-checkout.config.ts). Checks every state the design asks for
 * and that the card checkout is never affected.
 */
const FAKE_IDENTITY = "http://127.0.0.1:3910";
const ORDER_ID = "00000000-0000-4000-8000-000000000123";
const FAKE_STRIPE = readFileSync(path.join(import.meta.dirname, "fake-stripe.js"), "utf8");
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, "../../../docs/design/screenshots/gap-49");
const SCREENSHOTS = process.env.EXPRESS_CHECKOUT_SCREENSHOTS === "1";

type StripeScenario = {
  available?: Record<string, boolean>;
  hold?: boolean;
  loadError?: boolean;
  payment?: "declined";
};
type ShopScenario = { start?: string; address?: string; confirm?: string };
type Theme = "light" | "dark";

async function setUp(
  page: Page,
  options: { stripe?: StripeScenario; shop?: ShopScenario; signedIn?: boolean; theme?: Theme } = {},
) {
  const response = await page.request.post(`${FAKE_IDENTITY}/__scenario`, {
    data: options.shop ?? {},
  });
  expect(response.ok()).toBe(true);
  const stripeRequests: string[] = [];
  await page.route("https://js.stripe.com/**", (route) => {
    stripeRequests.push(route.request().url());
    return route.fulfill({ contentType: "application/javascript", body: FAKE_STRIPE });
  });
  await page.addInitScript((scenario) => {
    (window as unknown as { __fakeStripeScenario: unknown }).__fakeStripeScenario = scenario;
  }, options.stripe ?? {});
  const base = test.info().project.use.baseURL ?? "http://localhost:3925";
  await page
    .context()
    .addCookies([
      { name: "lax_theme", value: options.theme ?? "light", url: base },
      ...(options.signedIn ? [{ name: "shop_identity_session", value: "gate", url: base }] : []),
    ]);
  return { stripeRequests };
}

async function shopRequests(page: Page) {
  const response = await page.request.get(`${FAKE_IDENTITY}/__requests`);
  return (await response.json()) as { audience?: string; step: string; body?: unknown }[];
}

function walletGroup(page: Page, name: "Express checkout" | "Or pay with" = "Express checkout") {
  return page.getByRole("group", { name });
}

async function openDetails(page: Page) {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Your email" })).toBeVisible({ timeout: 60_000 });
}

async function fakeStripe(page: Page, call: string, arg?: unknown) {
  return page.evaluate(
    ([name, value]) => {
      const fake = (
        window as unknown as { __fakeStripe: Record<string, (arg?: unknown) => unknown> }
      ).__fakeStripe;
      return fake[name as string]?.(value);
    },
    [call, arg] as const,
  );
}

async function shot(page: Page, name: string) {
  if (!SCREENSHOTS) return;
  // Next's development badge is not part of the page.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

test.describe("express checkout on Details (guest)", () => {
  test("shows the wallet row first, with the card checkout unchanged below", async ({ page }) => {
    const { stripeRequests } = await setUp(page);
    await openDetails(page);
    const group = walletGroup(page);
    await expect(group.getByRole("button", { name: "Buy with Apple Pay" })).toBeVisible();
    await expect(group).not.toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { name: "Express checkout" })).toBeVisible();
    await expect(page.getByText("Or continue below")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue as guest" })).toBeEnabled();
    expect(stripeRequests).toEqual(["https://js.stripe.com/basil/stripe.js"]);
    const [start] = await shopRequests(page);
    expect(start).toMatchObject({ audience: "guest", step: "start" });
  });

  test("keeps the buttons' height while loading, so the form does not move", async ({ page }) => {
    await setUp(page, { stripe: { hold: true } });
    await openDetails(page);
    const group = walletGroup(page);
    await expect(group).toHaveAttribute("aria-busy", "true");
    const loadingBox = await group.boundingBox();
    expect(loadingBox?.height).toBeGreaterThanOrEqual(48);
    const emailTop = (await page.getByRole("heading", { name: "Your email" }).boundingBox())?.y;

    await setUp(page);
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    const readyTop = (await page.getByRole("heading", { name: "Your email" }).boundingBox())?.y;
    expect(Math.abs((readyTop ?? 0) - (emailTop ?? 0))).toBeLessThanOrEqual(1);
  });

  test("hides the row without a gap when no wallet is available", async ({ page }) => {
    await setUp(page, {
      stripe: { available: { applePay: false, googlePay: false, link: false } },
    });
    await openDetails(page);
    await expect(page.getByRole("heading", { name: "Express checkout" })).toHaveCount(0);
    await expect(page.locator(".shop-express__slot")).toBeHidden();
    await expect(page.getByRole("button", { name: "Continue as guest" })).toBeEnabled();
  });

  test("hides the row when shop-api has express checkout off", async ({ page }) => {
    await setUp(page, { shop: { start: "disabled" } });
    await openDetails(page);
    await expect(page.getByRole("heading", { name: "Express checkout" })).toHaveCount(0);
    await expect(page.locator(".shop-express__slot")).toBeHidden();
  });

  test("shows one plain line when the row cannot load", async ({ page }) => {
    await setUp(page, { shop: { start: "error" } });
    await openDetails(page);
    await expect(page.locator(".shop-express").getByRole("alert")).toHaveText(
      "Express checkout is unavailable right now. You can still check out as usual.",
    );
    await expect(walletGroup(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue as guest" })).toBeEnabled();
  });

  test("pays and lands on the order confirmation", async ({ page }) => {
    await setUp(page);
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    await fakeStripe(page, "confirm");
    await page.waitForURL(`**/checkout/confirmation?orderId=${ORDER_ID}`);
    const confirm = (await shopRequests(page)).find((request) => request.step === "confirm");
    expect(confirm).toMatchObject({
      audience: "guest",
      body: {
        basketId: "00000000-0000-4000-8000-000000000990",
        sessionId: "cs_test_expressGate0001",
        shippingRateId: "uk_insured_delivery",
        name: "Ada Lovelace",
        phone: "+447700900123",
        email: "ada@example.test",
        marketingConsent: false,
        shippingAddress: { postcode: "W1G 8UR", country: "GB" },
      },
    });
  });

  test("says the print has just sold out", async ({ page }) => {
    await setUp(page, { shop: { confirm: "sold_out" } });
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    await fakeStripe(page, "confirm");
    await expect(page.locator(".shop-express").getByRole("alert")).toHaveText(
      "This print has just sold out",
    );
    const failures = await page.evaluate(
      () => (window as unknown as { __fakeStripe: { failures: unknown[] } }).__fakeStripe.failures,
    );
    expect(failures).toHaveLength(1);
  });

  test("says nothing was charged when the Shop refuses the payment set-up", async ({ page }) => {
    await setUp(page, { shop: { confirm: "conflict" } });
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    await fakeStripe(page, "confirm");
    await expect(page.locator(".shop-express").getByRole("alert")).toContainText(
      "you have not been charged",
    );
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
  });

  test("releases the order when the payment is declined", async ({ page }) => {
    await setUp(page, { stripe: { payment: "declined" } });
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    await fakeStripe(page, "confirm");
    await expect(page.locator(".shop-express").getByRole("alert")).toContainText(
      "you have not been charged",
    );
    await expect
      .poll(async () => (await shopRequests(page)).map((r) => r.step))
      .toContain("cancel");
  });

  test("notes a closed sheet quietly", async ({ page }) => {
    await setUp(page);
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    await fakeStripe(page, "cancel");
    await expect(page.locator(".shop-express").getByRole("status")).toHaveText(
      "Payment cancelled. You have not been charged.",
    );
  });

  test("refuses an address outside the UK", async ({ page }) => {
    await setUp(page, { shop: { address: "refused" } });
    await openDetails(page);
    await expect(walletGroup(page).getByRole("button").first()).toBeVisible();
    expect(await fakeStripe(page, "changeAddress", { country: "FR", city: "Paris" })).toBe(
      "rejected",
    );
    await expect(page.locator(".shop-express").getByRole("alert")).toContainText(
      "UK addresses only",
    );
    const change = (await shopRequests(page)).find((r) => r.step === "shipping-address");
    expect(change?.body).toMatchObject({ address: { country: "FR", city: "Paris" } });
  });
});

test.describe("express checkout on the basket", () => {
  test("sits under Checkout as 'Or pay with' and uses the account route when signed in", async ({
    page,
  }) => {
    const { stripeRequests } = await setUp(page, { signedIn: true });
    await page.goto("/basket");
    const checkout = page.getByRole("link", { name: "Checkout", exact: true });
    await expect(checkout).toBeVisible({ timeout: 60_000 });
    const group = walletGroup(page, "Or pay with");
    await group.scrollIntoViewIfNeeded();
    await expect(group.getByRole("button").first()).toBeVisible();
    const checkoutBox = await checkout.boundingBox();
    const groupBox = await group.boundingBox();
    expect((groupBox?.y ?? 0) > (checkoutBox?.y ?? 0)).toBe(true);
    expect(stripeRequests).toHaveLength(1);
    const [start] = await shopRequests(page);
    expect(start).toMatchObject({ audience: "account", step: "start" });
  });

  test("never makes the page scroll sideways at 375", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setUp(page);
    for (const route of ["/basket", "/checkout"]) {
      await page.goto(route);
      const slot = page.locator(".shop-express__slot");
      await slot.scrollIntoViewIfNeeded();
      await expect(slot.getByRole("button").first()).toBeVisible({ timeout: 60_000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, route).toBeLessThanOrEqual(0);
    }
  });

  test("never loads Stripe.js or its policy on other pages", async ({ page }) => {
    const { stripeRequests } = await setUp(page);
    const response = await page.goto("/help");
    expect(response?.headers()["content-security-policy"] ?? "").not.toContain("js.stripe.com");
    await page.waitForLoadState("networkidle");
    expect(stripeRequests).toHaveLength(0);
    const basket = await page.goto("/basket");
    expect(basket?.headers()["content-security-policy"]).toContain("https://js.stripe.com");
  });
});

test.describe("design screenshots", () => {
  test.skip(!SCREENSHOTS, "EXPRESS_CHECKOUT_SCREENSHOTS=1 writes docs/design/screenshots/gap-49");
  test.use({ deviceScaleFactor: 2 });

  const sizes = [
    { name: "1440", width: 1440, height: 900 },
    { name: "375", width: 375, height: 812 },
  ];
  const themes: Theme[] = ["light", "dark"];

  for (const size of sizes) {
    for (const theme of themes) {
      test(`Details and basket states at ${size.name} ${theme}`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: size.width, height: size.height });
        const suffix = `${size.name}-${theme}`;

        const details = async (
          name: string,
          options: Parameters<typeof setUp>[1],
          act?: () => Promise<void>,
        ) => {
          await setUp(page, { ...options, theme });
          await openDetails(page);
          await act?.();
          await page.waitForTimeout(300);
          await shot(page, `details-${name}-${suffix}`);
        };
        const ready = () => expect(walletGroup(page).getByRole("button").first()).toBeVisible();

        await details("loading", { stripe: { hold: true } });
        await details("ready", {}, ready);
        await details(
          "unavailable",
          { stripe: { available: { applePay: false, googlePay: false, link: false } } },
          () => expect(page.locator(".shop-express__slot")).toBeHidden(),
        );
        await details("error", { shop: { start: "error" } }, () =>
          expect(page.locator(".shop-express").getByRole("alert")).toBeVisible(),
        );
        await details("sold-out", { shop: { confirm: "sold_out" } }, async () => {
          await ready();
          await fakeStripe(page, "confirm");
          await expect(page.locator(".shop-express").getByRole("alert")).toBeVisible();
        });
        await details("not-charged", { shop: { confirm: "conflict" } }, async () => {
          await ready();
          await fakeStripe(page, "confirm");
          await expect(page.locator(".shop-express").getByRole("alert")).toBeVisible();
        });
        await details("cancelled", {}, async () => {
          await ready();
          await fakeStripe(page, "cancel");
          await expect(page.locator(".shop-express").getByRole("status")).toBeVisible();
        });

        const basket = async (
          name: string,
          options: Parameters<typeof setUp>[1],
          act?: () => Promise<void>,
        ) => {
          await setUp(page, { ...options, theme });
          await page.goto("/basket");
          await expect(page.getByRole("link", { name: "Checkout", exact: true })).toBeVisible({
            timeout: 60_000,
          });
          await page.locator(".shop-express__slot").scrollIntoViewIfNeeded();
          await act?.();
          // Centred, so the row is clear of the phone's bottom bar.
          await page
            .locator(".shop-express__slot")
            .evaluate((slot) => slot.scrollIntoView({ block: "center" }));
          await page.waitForTimeout(300);
          await shot(page, `basket-${name}-${suffix}`);
        };
        await basket("loading", { stripe: { hold: true } });
        await basket("ready", {}, () =>
          expect(walletGroup(page, "Or pay with").getByRole("button").first()).toBeVisible(),
        );
        await basket("error", { shop: { start: "error" } }, () =>
          expect(page.locator(".shop-express").getByRole("alert")).toBeVisible(),
        );
      });
    }
  }
});
