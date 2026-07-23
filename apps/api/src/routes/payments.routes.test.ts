import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPaymentRoutes } from "./payments.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const addressId = "00000000-0000-4000-8000-0000000000a1";

function mountPaymentRoutes(
  initiateBuyerCheckout: ContainerPaymentHttpRoutesSlice["finance"]["buyerPaymentHttp"]["initiateBuyerCheckout"],
) {
  const app = new Hono();
  const entityStaffPayment = {
    listAllForAdmin: vi.fn(),
    markCapturedByAdmin: vi.fn(),
    refundPayment: vi.fn(),
  };
  const buyerPaymentHttp = {
    getBuyerComplianceGate: vi.fn(),
    getBuyerSourceOfFundsView: vi.fn(),
    listMyPayments: vi.fn(),
    cancelPendingPayment: vi.fn(),
    getWinnerLotFulfilment: vi.fn(),
    initiateBuyerCheckout,
    attachSourceOfFundsDocument: vi.fn(),
    submitSourceOfFundsDocuments: vi.fn(),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: {
      entityStaffPayment,
      buyerPaymentHttp,
    },
    legalEntityRepository: {},
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
  } as unknown as ContainerPaymentHttpRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () => ({
      id: "buyer-1",
      role: "client" as UserRole,
      staffRole: null,
    })),
  };
  app.route("/payments", createPaymentRoutes(container, authenticator));
  return { app, buyerPaymentHttp };
}

describe("POST /payments", () => {
  it("returns 201 with checkoutUrl for winning buyer", async () => {
    const initiateBuyerCheckout = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: {
        paymentId: "pay-1",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test",
        checkoutRail: "card" as const,
        manualReviewReason: null,
        marketingEventId: "evt-1",
      },
    });
    const { app } = mountPaymentRoutes(initiateBuyerCheckout);

    const res = await app.request("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, addressId }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { paymentId: string; checkoutUrl: string; checkoutRail: string };
    };
    expect(body.data.paymentId).toBe("pay-1");
    expect(body.data.checkoutUrl).toContain("checkout.stripe.com");
    expect(body.data.checkoutRail).toBe("card");
    expect(initiateBuyerCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerUserId: "buyer-1",
        lotId,
        addressId,
      }),
    );
  });

  it("returns 400 when amount exceeds online limit", async () => {
    const initiateBuyerCheckout = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      error: "Payment amount exceeds the maximum online payment limit. Contact settlements.",
      code: "payment_amount_exceeds_limit",
    });
    const { app } = mountPaymentRoutes(initiateBuyerCheckout);

    const res = await app.request("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, addressId }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: "payment_amount_exceeds_limit",
    });
  });

  it("returns 503 when accounting invoice is unavailable", async () => {
    const initiateBuyerCheckout = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      error: "Accounting invoice unavailable",
      code: "accounting_unavailable",
    });
    const { app } = mountPaymentRoutes(initiateBuyerCheckout);

    const res = await app.request("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, addressId }),
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: "accounting_unavailable",
    });
  });
});
