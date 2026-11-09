import { verifyBearerToken } from "@auction/auth/token-verifier";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "subject-1",
    payload: { scope: "shop.write" },
  })),
}));
import { createShopApiApp } from "../../app.js";
import type { DeliveryQuoteRequestOutcome } from "../../application/delivery-quote-request/delivery-quote-request.service.js";
import { DeliveryQuoteRequestRejectedError } from "../../errors/delivery-quote-request-rejected-error.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const USER_TOKEN = "user-token-placeholder";

const payload = {
  basketId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "delivery-quote:basket-0001",
  successUrl: "https://test-shop.lax.bid/checkout/confirmation",
  cancelUrl: "https://test-shop.lax.bid/checkout",
  deliveryAddress: {
    recipientName: "Anna Weber",
    line1: "Friedrichstrasse 12",
    city: "Berlin",
    postcode: "10117",
    country: "DE",
  },
  deliveryPhone: "+49 30 1234567",
};

async function appWith(requestDeliveryQuote: ReturnType<typeof vi.fn>) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      commerce: { ...base.commerce, requestDeliveryQuote },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const post = (app: Awaited<ReturnType<typeof appWith>>, body: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/orders/delivery-quote-request",
    headers: { authorization: `Bearer ${USER_TOKEN}` },
    payload: body as Record<string, unknown>,
  });

describe("POST /v1/orders/delivery-quote-request", () => {
  it("tells the buyer their print is held and until when", async () => {
    const outcome: DeliveryQuoteRequestOutcome = {
      kind: "quote_requested",
      request: {
        orderId: "00000000-0000-4000-8000-0000000000aa",
        orderReference: "LAX-S-10482",
        holdUntil: new Date("2026-11-16T12:00:00Z"),
        country: "DE",
        regionId: "eu",
      },
    };
    const request = vi.fn(async () => outcome);
    const app = await appWith(request);
    const response = await post(app, payload);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "quote_requested",
      orderReference: "LAX-S-10482",
      holdUntil: "2026-11-16T12:00:00.000Z",
      regionId: "eu",
      country: "DE",
    });
    // The buyer's id comes from their token, never the body.
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "subject-1", deliveryPhone: "+49 30 1234567" }),
    );
    await app.close();
  });

  it("sends a fixed-rate region straight to payment", async () => {
    const request = vi.fn(async () => ({
      kind: "pay_now" as const,
      session: {
        orderId: "00000000-0000-4000-8000-0000000000bb",
        checkoutUrl: "https://pay.example/session",
        expiresAt: new Date("2026-11-11T12:30:00Z"),
      },
    }));
    const app = await appWith(request);
    const response = await post(app, payload);
    expect(response.json()).toEqual({
      outcome: "pay_now",
      checkoutUrl: "https://pay.example/session",
    });
    await app.close();
  });

  it("answers an export-restricted country with a refusal, not an error", async () => {
    const request = vi.fn(async () => ({ kind: "not_delivered" as const, country: "RU" }));
    const app = await appWith(request);
    const response = await post(app, {
      ...payload,
      deliveryAddress: { ...payload.deliveryAddress, country: "RU" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "not_delivered", country: "RU" });
    await app.close();
  });

  it("names the address fields that need another look", async () => {
    const request = vi.fn(async () => {
      throw new DeliveryQuoteRequestRejectedError([{ field: "phone", reason: "invalid_phone" }]);
    });
    const app = await appWith(request);
    const response = await post(app, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [{ field: "phone", reason: "invalid_phone" }],
    });
    await app.close();
  });

  it("refuses a request without a phone before anything is created", async () => {
    const request = vi.fn();
    const app = await appWith(request);
    const { deliveryPhone: _phone, ...withoutPhone } = payload;
    const response = await post(app, withoutPhone);
    expect(response.statusCode).toBe(400);
    expect(request).not.toHaveBeenCalled();
    await app.close();
  });

  it("needs the write scope", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.read" },
    } as never);
    const request = vi.fn();
    const app = await appWith(request);
    const response = await post(app, payload);
    expect(response.statusCode).toBe(403);
    expect(request).not.toHaveBeenCalled();
    await app.close();
  });
});
