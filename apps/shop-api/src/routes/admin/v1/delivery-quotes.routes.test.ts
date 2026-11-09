import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { DeliveryQuoteStaffRejectedError } from "../../../errors/delivery-quote-staff-rejected-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "99999999-9999-4999-8999-999999999999",
};
const QUOTE_ID = "00000000-0000-4000-8000-0000000000a1";

async function buildApp(role: ShopStaffRole, quotes: Record<string, unknown> = {}) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const deliveryQuotes = {
    list: vi.fn(async () => ({
      items: [
        {
          id: QUOTE_ID,
          orderId: "00000000-0000-4000-8000-0000000000b1",
          orderReference: "LAX-S-10482",
          status: "requested" as const,
          country: "DE",
          regionId: "eu" as const,
          recipientName: "Anna Weber",
          address: ["Friedrichstrasse 12", "Berlin 10117", "Germany"],
          phone: "+49 30 1234567",
          items: ["Warm Basket"],
          merchandisePence: 42000,
          requestedAt: new Date("2026-11-10T09:00:00Z"),
          holdUntil: new Date("2026-11-13T09:00:00Z"),
          quote: null,
          endReason: null,
          declineNote: null,
        },
      ],
      waitingCount: 1,
    })),
    waitingCount: vi.fn(async () => 3),
    sendQuote: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    ...quotes,
  };
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: [role],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        deliveryQuotes: deliveryQuotes as never,
        exportPaymentEnabled: false,
      },
    }),
    logger: false,
  });
  await app.ready();
  return { app, deliveryQuotes };
}

const quote = (app: Awaited<ReturnType<typeof buildApp>>["app"], body: unknown) =>
  app.inject({
    method: "PUT",
    url: `/admin/v1/orders/delivery-quotes/${QUOTE_ID}/quote`,
    headers,
    payload: body as Record<string, unknown>,
  });

describe("admin delivery quote routes", () => {
  it("lists the waiting requests for anyone who can open orders, with the count and whether payment is open", async () => {
    const { app } = await buildApp("finance");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/orders/delivery-quotes",
      headers,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.waitingCount).toBe(1);
    expect(body.paymentOpen).toBe(false);
    expect(body.items[0]).toMatchObject({
      orderReference: "LAX-S-10482",
      countryName: "Germany",
      regionName: "European Union",
      status: "requested",
      items: ["Warm Basket"],
    });
    await app.close();
  });

  it("gives the nav its count of requests waiting", async () => {
    const { app } = await buildApp("operations");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/orders/delivery-quotes/summary",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ waitingCount: 3 });
    await app.close();
  });

  it("refuses a list to staff who cannot open orders", async () => {
    const { app } = await buildApp("editor");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/orders/delivery-quotes",
      headers,
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("lets operations send a quote, with the idempotency key and their own subject", async () => {
    const { app, deliveryQuotes } = await buildApp("operations");
    const response = await quote(app, {
      pricePence: 8500,
      carrier: "DHL Express",
      service: "Express insured",
    });
    expect(response.statusCode).toBe(204);
    expect(deliveryQuotes.sendQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: QUOTE_ID,
        pricePence: 8500,
        carrier: "DHL Express",
        actorSubjectId: "operations-subject",
        idempotencyKey: headers["idempotency-key"],
      }),
    );
    await app.close();
  });

  it("keeps quoting from finance and read-only staff, changing nothing", async () => {
    for (const role of ["finance", "read_only"] as const) {
      const { app, deliveryQuotes } = await buildApp(role);
      expect((await quote(app, { pricePence: 8500, carrier: "DHL" })).statusCode).toBe(403);
      const decline = await app.inject({
        method: "POST",
        url: `/admin/v1/orders/delivery-quotes/${QUOTE_ID}/decline`,
        headers,
        payload: { note: "No." },
      });
      expect(decline.statusCode).toBe(403);
      expect(deliveryQuotes.sendQuote).not.toHaveBeenCalled();
      expect(deliveryQuotes.decline).not.toHaveBeenCalled();
      await app.close();
    }
  });

  it("names the fields of a quote that needs another look", async () => {
    const { app } = await buildApp("shop_admin", {
      sendQuote: vi.fn(async () => {
        throw new DeliveryQuoteStaffRejectedError([{ field: "carrier", reason: "required" }]);
      }),
    });
    const response = await quote(app, { pricePence: 8500, carrier: "" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "shop.validation",
      issues: [{ field: "carrier", reason: "required" }],
    });
    await app.close();
  });

  it("lets account managers turn a request down with a reason", async () => {
    const { app, deliveryQuotes } = await buildApp("account_manager");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/orders/delivery-quotes/${QUOTE_ID}/decline`,
      headers,
      payload: { note: "Our couriers cannot collect from there." },
    });
    expect(response.statusCode).toBe(204);
    expect(deliveryQuotes.decline).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: QUOTE_ID,
        note: "Our couriers cannot collect from there.",
      }),
    );
    await app.close();
  });

  it("needs an idempotency key to quote", async () => {
    const { app, deliveryQuotes } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url: `/admin/v1/orders/delivery-quotes/${QUOTE_ID}/quote`,
      headers: { authorization: headers.authorization },
      payload: { pricePence: 8500, carrier: "DHL" },
    });
    expect(response.statusCode).toBe(400);
    expect(deliveryQuotes.sendQuote).not.toHaveBeenCalled();
    await app.close();
  });
});
