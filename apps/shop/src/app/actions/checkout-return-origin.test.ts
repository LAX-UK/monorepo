import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shopCommerceRequest = vi.fn();
const fetchShopCommerceCsrfForMutation = vi.fn();

vi.mock("@/lib/shop-commerce-request.server", () => ({ shopCommerceRequest }));
vi.mock("@/lib/shop-commerce-mutation.server", () => ({ fetchShopCommerceCsrfForMutation }));
vi.mock("@/lib/checkout/order-commerce-path.server", () => ({
  orderCommercePath: async (orderId: string, action: string) =>
    `/commerce/orders/${orderId}/${action}`,
}));
// A request that claims to come from another site: none of these headers may reach a return URL.
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-host": "evil.example, shop.lax.art",
      "x-forwarded-proto": "https",
      host: "evil.example",
    }),
}));

const SUCCESS = "https://shop.lax.art/checkout/confirmation?orderId={ORDER_ID}";
const CANCEL = "https://shop.lax.art/checkout/cancel?orderId={ORDER_ID}";

function sentBody(): Record<string, unknown> {
  const init = shopCommerceRequest.mock.calls[0]?.[1] as { body: string };
  return JSON.parse(init.body);
}

beforeEach(() => {
  shopCommerceRequest.mockReset();
  fetchShopCommerceCsrfForMutation.mockReset();
  fetchShopCommerceCsrfForMutation.mockResolvedValue({ ok: true, token: "csrf" });
  shopCommerceRequest.mockResolvedValue(new Response("{}", { status: 500 }));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("LAX_SHOP_STOREFRONT_URL", "https://shop.lax.art");
  vi.stubEnv("LAX_BID_PUBLIC_URL", "https://lax.bid");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe return URLs", () => {
  it("account checkout returns to the configured storefront, not the forwarded host", async () => {
    const { startCheckout } = await import("./checkout.actions.js");
    await startCheckout({ basketId: "b1", fulfilment: "collect_new_cavendish" });
    expect(sentBody()).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL });
  });

  it("resuming a payment returns to the configured storefront", async () => {
    const { resumeCheckoutPayment } = await import("./resume-checkout.actions.js");
    await resumeCheckoutPayment("order-1");
    expect(sentBody()).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL });
  });

  it("guest checkout returns to the configured storefront", async () => {
    const { startGuestCheckout } = await import("./guest-checkout.actions.js");
    await startGuestCheckout({
      basketId: "b1",
      email: "ada@example.com",
      name: "Ada",
      marketingConsent: false,
      fulfilment: "collect_new_cavendish",
    });
    expect(sentBody()).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL });
  });
});
