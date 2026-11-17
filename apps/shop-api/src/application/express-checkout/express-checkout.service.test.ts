import { EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type {
  ExpressCheckoutBasketReader,
  ExpressCheckoutGateway,
  ExpressCheckoutSnapshot,
} from "../ports/express-checkout.ports.js";
import {
  EXPRESS_SESSION_REUSE_WINDOW_MS,
  type ExpressConfirmInput,
  createExpressCheckoutService,
} from "./express-checkout.service.js";

const BASKET = "22222222-2222-4222-8222-222222222222";
const SESSION = "cs_test_express1";
const SUBJECT = { kind: "subject" as const, identitySubjectId: "collector-1" };

function snapshot(overrides: Partial<ExpressCheckoutSnapshot> = {}): ExpressCheckoutSnapshot {
  return {
    sessionId: SESSION,
    status: "open",
    isShopExpress: true,
    basketId: BASKET,
    orderId: null,
    currency: "gbp",
    amountSubtotalPence: 8_000,
    amountTotalPence: 8_000,
    shippingOptionAmountsPence: [1_500, 0],
    shippingDetails: null,
    bindRevision: 0,
    ...overrides,
  };
}

function harness(read: ExpressCheckoutSnapshot | null = snapshot()) {
  const baskets: ExpressCheckoutBasketReader = {
    loadExpressBasket: vi.fn(async () => ({
      lines: [{ title: "Print", description: "Artist", quantity: 1, unitAmountPence: 8_000 }],
      subtotalPence: 8_000,
      contentKey: "content",
    })),
    assertBasketOwned: vi.fn(async () => undefined),
  };
  const gateway: ExpressCheckoutGateway = {
    createExpressCheckout: vi.fn(async (input) => ({
      sessionId: SESSION,
      clientSecret: "secret",
      expiresAt: input.expiresAt,
    })),
    readExpressCheckout: vi.fn(async () => read),
    bindExpressCheckout: vi.fn(async () => ({ amountTotalPence: 9_500 })),
  };
  const now = new Date("2026-11-17T10:04:00Z");
  const service = createExpressCheckoutService({
    baskets,
    gateway,
    storefrontUrl: "https://shop.example/",
    customerEmail: async () => "ada@example.com",
    now: () => now,
  });
  return { service, baskets, gateway, now };
}

const confirmInput = (overrides: Partial<ExpressConfirmInput> = {}): ExpressConfirmInput => ({
  owner: SUBJECT,
  basketId: BASKET,
  sessionId: SESSION,
  shippingRateId: "uk_insured_delivery",
  name: "Ada Lovelace",
  phone: "07700 900123",
  shippingAddress: {
    line1: "1 High Street",
    city: "London",
    postcode: "SW1A 1AA",
    country: "gb",
  },
  ...overrides,
});

describe("express checkout service", () => {
  it("opens a session for the basket with both rates, keyed so a repeat reuses it", async () => {
    const { service, gateway, now } = harness();
    const session = await service.start({ owner: SUBJECT, basketId: BASKET });
    expect(session.subtotalPence).toBe(8_000);
    expect(session.shippingRates.map((rate) => [rate.id, rate.amountPence])).toEqual([
      ["uk_insured_delivery", 1_500],
      ["collect_new_cavendish", 0],
    ]);
    const window = Math.floor(now.getTime() / EXPRESS_SESSION_REUSE_WINDOW_MS);
    expect(gateway.createExpressCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        basketId: BASKET,
        idempotencyKey: `checkout:shop-express:${BASKET}:content:${window}`,
        subtotalPence: 8_000,
        returnUrl: "https://shop.example/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}",
        customerEmail: "ada@example.com",
        expiresAt: new Date((window + 1) * EXPRESS_SESSION_REUSE_WINDOW_MS + 31 * 60_000),
      }),
    );
  });

  it("asks for the same session, with the same expiry, on a repeat inside the window", async () => {
    const { service, gateway, now } = harness();
    await service.start({ owner: SUBJECT, basketId: BASKET });
    now.setTime(now.getTime() + 60_000);
    await service.start({ owner: SUBJECT, basketId: BASKET });
    const [first, second] = vi.mocked(gateway.createExpressCheckout).mock.calls.map(([c]) => c);
    expect(second).toEqual(first);
    const lifetime = (first?.expiresAt.getTime() ?? 0) - now.getTime();
    expect(lifetime).toBeGreaterThanOrEqual(30 * 60_000);
    expect(lifetime).toBeLessThanOrEqual(41 * 60_000);
  });

  it("opens a new session when the one Stripe hands back for the key has ended", async () => {
    const { service, gateway } = harness(snapshot({ status: "expired" }));
    await service.start({ owner: SUBJECT, basketId: BASKET });
    const keys = vi
      .mocked(gateway.createExpressCheckout)
      .mock.calls.map(([call]) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(`${keys[0]}:after:${SESSION}`);
  });

  it("checks the basket is the shopper's before opening anything", async () => {
    const { service, baskets, gateway } = harness();
    vi.mocked(baskets.loadExpressBasket).mockImplementationOnce(async ({ ownedBy }) => {
      expect(ownedBy({ kind: "subject", identitySubjectId: "someone-else" })).toBe(false);
      expect(ownedBy(SUBJECT)).toBe(true);
      expect(ownedBy({ kind: "anonymous", tokenHash: "x" })).toBe(false);
      throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Basket ownership mismatch", 403);
    });
    await expect(service.start({ owner: SUBJECT, basketId: BASKET })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(gateway.createExpressCheckout).not.toHaveBeenCalled();
  });

  describe("address change", () => {
    it("offers both UK rates for a UK address", async () => {
      const { service } = harness();
      const rates = await service.changeShippingAddress({
        owner: SUBJECT,
        basketId: BASKET,
        sessionId: SESSION,
        address: { country: "GB" },
      });
      expect(rates.map((rate) => rate.id)).toEqual([
        "uk_insured_delivery",
        "collect_new_cavendish",
      ]);
    });

    it("refuses an address outside the UK without calling Stripe", async () => {
      const { service, gateway } = harness();
      await expect(
        service.changeShippingAddress({
          owner: SUBJECT,
          basketId: BASKET,
          sessionId: SESSION,
          address: { country: "FR" },
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("UK") });
      expect(gateway.readExpressCheckout).not.toHaveBeenCalled();
    });

    it("refuses a session that is not this basket's, or has ended", async () => {
      for (const [read, status] of [
        [null, 404],
        [snapshot({ basketId: "33333333-3333-4333-8333-333333333333" }), 404],
        [snapshot({ isShopExpress: false }), 404],
        [snapshot({ status: "expired" }), 409],
      ] as const) {
        const { service } = harness(read);
        await expect(
          service.changeShippingAddress({
            owner: SUBJECT,
            basketId: BASKET,
            sessionId: SESSION,
            address: { country: "GB" },
          }),
        ).rejects.toMatchObject({ statusCode: status });
      }
    });
  });

  describe("confirm", () => {
    it("makes an insured-delivery order on the session, one per session", async () => {
      const { service } = harness();
      const place = vi.fn(async () => "placed");
      expect(await service.confirm(confirmInput(), place)).toBe("placed");
      expect(place).toHaveBeenCalledWith({
        basketId: BASKET,
        fulfilment: "uk_insured_delivery",
        idempotencyKey: `express:${SESSION}`,
        successUrl: "https://shop.example/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "https://shop.example/basket",
        deliveryAddress: {
          recipientName: "Ada Lovelace",
          line1: "1 High Street",
          city: "London",
          postcode: "SW1A 1AA",
          country: "GB",
        },
        deliveryPhone: "07700 900123",
        express: {
          sessionId: SESSION,
          shipping: {
            name: "Ada Lovelace",
            line1: "1 High Street",
            city: "London",
            postcode: "SW1A 1AA",
            country: "GB",
          },
        },
      });
    });

    it("makes a collection order with no delivery address and no phone needed", async () => {
      const { service } = harness();
      const place = vi.fn(async () => "placed");
      await service.confirm(
        confirmInput({ shippingRateId: "collect_new_cavendish", phone: undefined }),
        place,
      );
      const [order] = place.mock.calls[0] as unknown as [Record<string, unknown>];
      expect(order.fulfilment).toBe("collect_new_cavendish");
      expect(order).not.toHaveProperty("deliveryAddress");
      expect(order).not.toHaveProperty("deliveryPhone");
    });

    it("needs a phone for insured delivery and a UK address for either rate", async () => {
      const { service } = harness();
      const place = vi.fn();
      await expect(
        service.confirm(confirmInput({ phone: undefined }), place),
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        service.confirm(
          confirmInput({
            shippingRateId: "collect_new_cavendish",
            shippingAddress: { line1: "1 Rue", city: "Paris", postcode: "75001", country: "FR" },
          }),
          place,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(place).not.toHaveBeenCalled();
    });

    it("fails with 'This print has just sold out' when the print sold meanwhile", async () => {
      const { service } = harness();
      const place = vi.fn(async () => {
        throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Edition unavailable", 409);
      });
      await expect(service.confirm(confirmInput(), place)).rejects.toMatchObject({
        code: SHOP_API_ERROR_CODES.OUT_OF_STOCK,
        statusCode: 409,
        message: EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE,
      });
    });

    it("passes every other refusal through as it is", async () => {
      const { service } = harness();
      const refusal = new ShopApiError(
        SHOP_API_ERROR_CODES.PRICE_CHANGED,
        "Basket price changed",
        409,
      );
      await expect(
        service.confirm(confirmInput(), async () => {
          throw refusal;
        }),
      ).rejects.toBe(refusal);
    });
  });
});
