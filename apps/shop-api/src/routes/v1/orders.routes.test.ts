import { verifyBearerToken } from "@auction/auth/token-verifier";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "subject-1",
    payload: { scope: "shop.read" },
  })),
}));
import { createShopApiApp } from "../../app.js";
import { createEnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import { sampleOrderRecord } from "../../test-support/order-record.fixture.js";

const USER_TOKEN = "user-token-placeholder";

describe("orders routes", () => {
  it("rejects delivery checkout without a delivery phone before creating a session", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const checkoutOrder = vi.fn();
    const deps = createMinimalShopApiTestDeps({
      commerce: { ...createMinimalShopApiTestDeps().commerce, checkoutOrder },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/checkout",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: {
        basketId: "00000000-0000-4000-8000-000000000001",
        fulfilment: "uk_insured_delivery",
        idempotencyKey: "idem-key-0001",
        successUrl: "https://test-shop.lax.bid/checkout/success",
        cancelUrl: "https://test-shop.lax.bid/checkout",
        deliveryAddress: {
          line1: "1 High St",
          city: "Brighton",
          postcode: "BN1 1AA",
          country: "GB",
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "shop.validation" });
    expect(checkoutOrder).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when the order is missing", async () => {
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        getOrder: vi.fn(async () => null),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/orders/00000000-0000-4000-8000-000000000099",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("cancels a pending order with a JSON body the identity proxy can re-serialise", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const cancelCheckoutOrder = vi.fn(async () => undefined);
    const getOrder = vi.fn(async () =>
      sampleOrderRecord({
        orderId: "00000000-0000-4000-8000-000000000042",
        status: "cancelled",
        totalPence: 1000,
        merchandiseSubtotalPence: 1000,
        fulfilmentSurchargePence: 0,
        fulfilment: "collect_brunswick",
        lines: [],
        paidAt: null,
        deliveryAddress: null,
      }),
    );
    const deps = createMinimalShopApiTestDeps({
      commerce: { ...createMinimalShopApiTestDeps().commerce, cancelCheckoutOrder, getOrder },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const orderId = "00000000-0000-4000-8000-000000000042";
    const response = await app.inject({
      method: "POST",
      url: `/v1/orders/${orderId}/cancel`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ orderId, status: "cancelled" });
    expect(cancelCheckoutOrder).toHaveBeenCalledWith({ subject: "subject-1", orderId });
    // A 204 here would throw in the Hono proxy: `new Response(body, { status: 204 })` is invalid.
    expect(response.body.length).toBeGreaterThan(0);
    await app.close();
  });

  const checkoutPayload = {
    basketId: "00000000-0000-4000-8000-000000000001",
    fulfilment: "uk_insured_delivery",
    idempotencyKey: "idem-key-0001",
    successUrl: "https://test-shop.lax.bid/checkout/success",
    cancelUrl: "https://test-shop.lax.bid/checkout",
    deliveryAddress: {
      recipientName: "Ada Lovelace",
      line1: "1 High St",
      city: "Brighton",
      postcode: "BN1 1AA",
      country: "GB",
    },
    deliveryPhone: "07700 900123",
  };

  function checkoutApp(save: ReturnType<typeof vi.fn>) {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const checkoutOrder = vi.fn(async () => ({
      orderId: "00000000-0000-4000-8000-000000000042",
      checkoutUrl: "https://checkout.example.test/pay",
      expiresAt: new Date("2026-11-01T00:00:00.000Z"),
    }));
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        checkoutOrder,
        savedAddresses: { list: vi.fn(), save },
      },
    });
    return { app: createShopApiApp({ deps, logger: false }), checkoutOrder };
  }

  it("passes the recipient name to the order and saves the address only when asked", async () => {
    const save = vi.fn(async () => "saved" as const);
    const { app, checkoutOrder } = checkoutApp(save);
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/checkout",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: { ...checkoutPayload, saveAddress: true },
    });
    expect(response.statusCode).toBe(200);
    expect(checkoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAddress: expect.objectContaining({ recipientName: "Ada Lovelace" }),
      }),
    );
    expect(save).toHaveBeenCalledWith(
      "subject-1",
      expect.objectContaining({
        recipientName: "Ada Lovelace",
        line1: "1 High St",
        line2: null,
        country: "GB",
        phone: "07700 900123",
      }),
      expect.any(Function),
    );
    await app.close();
  });

  it("does not touch the address book without saveAddress", async () => {
    const save = vi.fn();
    const { app } = checkoutApp(save);
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/checkout",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: checkoutPayload,
    });
    expect(response.statusCode).toBe(200);
    expect(save).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers the saved addresses as unavailable where there is no address book", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/addresses",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: false, addresses: [] });
    await app.close();
  });

  const ORDER_ID = "550e8400-e29b-41d4-a716-846655440001";

  function orderApp(
    order: ReturnType<typeof sampleOrderRecord> | null,
    submit = vi.fn(async () => ({ reportId: "550e8400-e29b-41d4-a716-846655440099" })),
  ) {
    const base = createMinimalShopApiTestDeps();
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...base.commerce,
        getOrder: vi.fn(async () => order),
        getCustomerProfile: async () => ({ name: "Robert Thorne", email: "robert@example.test" }),
        orderProblems: {
          writer: { submit },
          rateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        },
      },
    });
    return { app: createShopApiApp({ deps, logger: false }), submit };
  }

  it("downloads the invoice of a paid order as a PDF named by the LAX document convention", async () => {
    const { app } = orderApp(sampleOrderRecord());
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/v1/orders/${ORDER_ID}/invoice`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="Paid Invoice - Thorne - LAX-S-10482 - 2026-10-01.pdf"; filename*=UTF-8''Paid%20Invoice%20%E2%80%94%20Thorne%20%E2%80%94%20LAX-S-10482%20%E2%80%94%202026-10-01.pdf`,
    );
    expect(response.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    await app.close();
  });

  it("has no invoice for an order that was never paid", async () => {
    const { app } = orderApp(sampleOrderRecord({ status: "expired", paidAt: null }));
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: `/v1/orders/${ORDER_ID}/invoice`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  describe("the Books invoice card and LAX's stored copy", () => {
    const DOCUMENT_ID = "550e8400-e29b-41d4-a716-846655440077";
    function cardApp(order: ReturnType<typeof sampleOrderRecord> | null, pdf: Buffer | null) {
      const base = createMinimalShopApiTestDeps();
      const card = vi.fn(async () => ({
        state: "issued" as const,
        invoiceNumber: "LAX-INV-000124",
        issuedAt: "2026-10-01T10:05:00.000Z",
        invoiceDocumentId: DOCUMENT_ID,
        cancelledAt: null,
      }));
      const document = vi.fn(async () =>
        pdf ? { pdf, filename: "invoice-LAX-INV-000124.pdf" } : null,
      );
      const deps = createMinimalShopApiTestDeps({
        commerce: {
          ...base.commerce,
          getOrder: vi.fn(async () => order),
          orderInvoiceCard: { card, document },
        },
      });
      return { app: createShopApiApp({ deps, logger: false }), card, document };
    }

    it("answers the card for the shopper's own order, never cached", async () => {
      const { app } = cardApp(sampleOrderRecord(), null);
      await app.ready();
      const response = await app.inject({
        method: "GET",
        url: `/v1/orders/${ORDER_ID}/invoice-card`,
        headers: { authorization: `Bearer ${USER_TOKEN}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ state: "issued", invoiceNumber: "LAX-INV-000124" });
      expect(response.headers["cache-control"]).toBe("private, no-store");
      await app.close();
    });

    it("answers someone else's order as not found, never cached, without reading Books", async () => {
      const { app, card } = cardApp(null, null);
      await app.ready();
      for (const url of [
        `/v1/orders/${ORDER_ID}/invoice-card`,
        `/v1/orders/${ORDER_ID}/invoice-documents/${DOCUMENT_ID}`,
      ]) {
        const response = await app.inject({
          method: "GET",
          url,
          headers: { authorization: `Bearer ${USER_TOKEN}` },
        });
        expect(response.statusCode, url).toBe(404);
        expect(response.headers["cache-control"], url).toBe("private, no-store");
      }
      expect(card).not.toHaveBeenCalled();
      await app.close();
    });

    it("sends LAX's stored copy as a PDF, and one uncached 404 when there is none to give", async () => {
      const served = cardApp(sampleOrderRecord(), Buffer.from("%PDF-1.4 stored"));
      await served.app.ready();
      const ok = await served.app.inject({
        method: "GET",
        url: `/v1/orders/${ORDER_ID}/invoice-documents/${DOCUMENT_ID}`,
        headers: { authorization: `Bearer ${USER_TOKEN}` },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.headers["content-type"]).toBe("application/pdf");
      expect(ok.headers["cache-control"]).toBe("private, no-store");
      expect(ok.headers["x-content-type-options"]).toBe("nosniff");
      expect(ok.headers["content-disposition"]).toContain("invoice-LAX-INV-000124.pdf");
      await served.app.close();

      const refused = cardApp(sampleOrderRecord(), null);
      await refused.app.ready();
      const none = await refused.app.inject({
        method: "GET",
        url: `/v1/orders/${ORDER_ID}/invoice-documents/${DOCUMENT_ID}`,
        headers: { authorization: `Bearer ${USER_TOKEN}` },
      });
      expect(none.statusCode).toBe(404);
      expect(none.headers["cache-control"]).toBe("private, no-store");
      const badId = await refused.app.inject({
        method: "GET",
        url: `/v1/orders/${ORDER_ID}/invoice-documents/not-a-uuid`,
        headers: { authorization: `Bearer ${USER_TOKEN}` },
      });
      expect(badId.statusCode).toBe(400);
      expect(badId.headers["cache-control"]).toBe("private, no-store");
      await refused.app.close();
    });
  });

  it("sends a problem report with the order reference while the window is open", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const { app, submit } = orderApp(sampleOrderRecord());
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: `/v1/orders/${ORDER_ID}/problem-reports`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: { reason: "damaged", details: "  The corner of the frame is cracked.  " },
    });
    expect(response.statusCode).toBe(201);
    expect(submit).toHaveBeenCalledWith({
      sender: expect.objectContaining({ kind: "account", identitySubjectId: "subject-1" }),
      orderReference: "LAX-S-10482",
      reason: "damaged",
      details: "The corner of the frame is cracked.",
    });
    await app.close();
  });

  it("refuses a problem report once the cancellation period has ended", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const { app, submit } = orderApp(
      sampleOrderRecord({ refundPeriodEndsAt: new Date("2026-01-01T00:00:00.000Z") }),
    );
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: `/v1/orders/${ORDER_ID}/problem-reports`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: { reason: "other", details: "It was lovely, just checking." },
    });
    expect(response.statusCode).toBe(409);
    expect(submit).not.toHaveBeenCalled();
    await app.close();
  });
});
