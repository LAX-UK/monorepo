import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import { createDrizzleCheckoutRepository } from "./drizzle-checkout.repository.js";
import { assertStorefrontRedirectUrl } from "./shop-basket.persistence.js";

const STOREFRONT = "https://shop.lax.test";
const refused = expect.objectContaining({ code: SHOP_API_ERROR_CODES.VALIDATION, statusCode: 400 });

describe("assertStorefrontRedirectUrl", () => {
  it("accepts a URL on the storefront's own origin, with or without a trailing slash", () => {
    for (const storefront of [STOREFRONT, `${STOREFRONT}/`, ` ${STOREFRONT}`]) {
      expect(() =>
        assertStorefrontRedirectUrl(
          `${STOREFRONT}/checkout/confirmation?orderId={ORDER_ID}`,
          storefront,
        ),
      ).not.toThrow();
    }
    // The default port is the same origin.
    expect(() => assertStorefrontRedirectUrl(`${STOREFRONT}:443/basket`, STOREFRONT)).not.toThrow();
  });

  it.each([
    ["another host", "https://elsewhere.test/checkout"],
    ["a sibling subdomain", "https://art.lax.test/checkout"],
    ["a host that only starts with the storefront's", "https://shop.lax.test.elsewhere.test/x"],
    ["another scheme", "http://shop.lax.test/checkout"],
    ["another port", "https://shop.lax.test:8443/checkout"],
    ["a user name", "https://user@shop.lax.test/checkout"],
    ["a password", "https://:pass@shop.lax.test/checkout"],
    ["a script URL", "javascript:alert(1)"],
    ["a relative URL", "/checkout/confirmation"],
    ["text that is not a URL", "not a url"],
  ])("refuses %s", (_label, url) => {
    expect(() => assertStorefrontRedirectUrl(url, STOREFRONT)).toThrow(refused);
  });

  it("allows nothing when the storefront URL does not parse or is not http(s)", () => {
    expect(() => assertStorefrontRedirectUrl(`${STOREFRONT}/checkout`, "")).toThrow(refused);
    expect(() => assertStorefrontRedirectUrl(`${STOREFRONT}/checkout`, "shop.lax.test")).toThrow(
      refused,
    );
    // A storefront on another scheme has an opaque origin, which must not match a script URL.
    expect(() => assertStorefrontRedirectUrl("javascript:alert(1)", "file:///srv/shop")).toThrow(
      refused,
    );
  });
});

describe("checkout return URLs", () => {
  // Any database use or payment session would mean the URLs were not checked first.
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error("database used before the return URLs were checked");
      },
    },
  );
  const createHostedCheckout = vi.fn();
  const repository = createDrizzleCheckoutRepository(
    db as never,
    { createHostedCheckout } as never,
    { storefrontUrl: STOREFRONT, domainEventMode: "off" },
  );
  const good = `${STOREFRONT}/checkout/confirmation?orderId={ORDER_ID}`;
  const bad = "https://elsewhere.test/checkout";

  it.each([
    ["success", { successUrl: bad, cancelUrl: good }],
    ["cancel", { successUrl: good, cancelUrl: bad }],
  ])("refuses a new checkout whose %s URL leaves the storefront", async (_label, urls) => {
    await expect(
      repository.createCheckoutOrder({
        subject: "sub-1",
        basketId: "basket-1",
        fulfilment: "collection",
        idempotencyKey: "idem-1",
        ...urls,
      } as never),
    ).rejects.toEqual(refused);
    expect(createHostedCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ["success", { successUrl: bad, cancelUrl: good }],
    ["cancel", { successUrl: good, cancelUrl: bad }],
  ])("refuses to resume a checkout whose %s URL leaves the storefront", async (_label, urls) => {
    await expect(
      repository.resumeCheckoutOrder({ subject: "sub-1", orderId: "order-1", ...urls }),
    ).rejects.toEqual(refused);
    expect(createHostedCheckout).not.toHaveBeenCalled();
  });
});
