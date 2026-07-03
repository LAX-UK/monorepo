import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { LotError, PaymentProviderError } from "../lib/errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPaymentRoutes } from "./payments.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const addressId = "00000000-0000-4000-8000-0000000000a1";

function mountPaymentRoutes(
  createPendingForWinner: Container["paymentBuyerService"]["createPendingForWinner"],
) {
  const app = new Hono();
  const paymentService = {
    createPendingForWinner,
    listAllForAdmin: vi.fn(),
    listMyPaymentsForBuyerApi: vi.fn(),
    getBuyerComplianceGateStatus: vi.fn(),
    cancelPendingAsBuyer: vi.fn(),
    markCapturedByAdmin: vi.fn(),
    refundPayment: vi.fn(),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    paymentService,
    paymentBuyerService: paymentService,
    paymentAdminService: paymentService,
    paymentMaintenanceService: paymentService,
    lotFulfilmentService: { getForWinner: vi.fn() },
    sourceOfFundsDocumentCollectionService: {},
    marketingEventService: { emit: vi.fn().mockResolvedValue(undefined) },
    redis: {},
    legalEntityRepository: {},
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () => ({
      id: "buyer-1",
      role: "client" as UserRole,
      staffRole: null,
    })),
  };
  app.route("/payments", createPaymentRoutes(container, authenticator));
  return { app, paymentService };
}

describe("POST /payments", () => {
  it("returns 201 with checkoutUrl for winning buyer", async () => {
    const createPendingForWinner = vi.fn().mockResolvedValue(
      ok({
        paymentId: "pay-1",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test",
        checkoutRail: "card" as const,
        manualReviewReason: null,
      }),
    );
    const { app } = mountPaymentRoutes(createPendingForWinner);

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
    expect(createPendingForWinner).toHaveBeenCalledWith("buyer-1", lotId, addressId);
  });

  it("returns 400 when amount exceeds online limit", async () => {
    const createPendingForWinner = vi
      .fn()
      .mockResolvedValue(
        err(
          new LotError(
            "Payment amount exceeds the maximum online payment limit. Contact settlements.",
            400,
            "payment_amount_exceeds_limit",
          ),
        ),
      );
    const { app } = mountPaymentRoutes(createPendingForWinner);

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
    const createPendingForWinner = vi
      .fn()
      .mockResolvedValue(
        err(
          new PaymentProviderError("Accounting invoice unavailable", 503, "accounting_unavailable"),
        ),
      );
    const { app } = mountPaymentRoutes(createPendingForWinner);

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
