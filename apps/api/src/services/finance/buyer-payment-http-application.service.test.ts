import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { LotError, PaymentProviderError } from "../../lib/errors.js";
import { BuyerPaymentHttpApplicationService } from "./buyer-payment-http-application.service.js";

describe("BuyerPaymentHttpApplicationService", () => {
  const redis = {} as import("ioredis").Redis;
  const sourceOfFundsDocumentCollectionService = {
    attachDocument: vi.fn(),
    submitDocuments: vi.fn(),
  };
  const paymentBuyerService = {
    createPendingForWinner: vi.fn(),
    listForBuyer: vi.fn(),
    listMyPaymentsForBuyerApi: vi.fn(),
    getBuyerComplianceGateStatus: vi.fn(),
    cancelPendingAsBuyer: vi.fn(),
  };
  const buyerComplianceHttp = {
    getBuyerSourceOfFundsView: vi.fn(),
  };
  const lotFulfilmentBuyer = {
    getForWinner: vi.fn(),
  };
  const marketingEventService = {
    emit: vi.fn(),
  };

  function service() {
    return new BuyerPaymentHttpApplicationService(
      redis,
      sourceOfFundsDocumentCollectionService as never,
      paymentBuyerService,
      buyerComplianceHttp,
      lotFulfilmentBuyer,
      marketingEventService as never,
    );
  }

  const websiteContext = {
    get: () => undefined,
    req: { header: () => undefined },
  };

  it("returns checkout payload when marketing emit fails after payment commit", async () => {
    paymentBuyerService.createPendingForWinner.mockResolvedValue(
      ok({
        paymentId: "pay-1",
        checkoutUrl: "https://checkout.stripe.com/x",
        checkoutRail: "card",
        manualReviewReason: null,
      }),
    );
    marketingEventService.emit.mockRejectedValue(new Error("queue down"));
    const result = await service().initiateBuyerCheckout({
      buyerUserId: "buyer-1",
      lotId: "lot-1",
      addressId: "addr-1",
      websiteContext,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.paymentId).toBe("pay-1");
    expect(result.data.marketingEventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("propagates stripe and lot error codes on checkout failure", async () => {
    paymentBuyerService.createPendingForWinner.mockResolvedValueOnce(
      err(
        new PaymentProviderError("Accounting invoice unavailable", 503, "accounting_unavailable"),
      ),
    );
    const stripeFail = await service().initiateBuyerCheckout({
      buyerUserId: "b",
      lotId: "l",
      addressId: "a",
      websiteContext,
    });
    expect(stripeFail).toMatchObject({ ok: false, code: "accounting_unavailable", status: 503 });

    paymentBuyerService.createPendingForWinner.mockResolvedValueOnce(
      err(new LotError("limit", 400, "payment_amount_exceeds_limit")),
    );
    const lotFail = await service().initiateBuyerCheckout({
      buyerUserId: "b",
      lotId: "l",
      addressId: "a",
      websiteContext,
    });
    expect(lotFail).toMatchObject({ ok: false, code: "payment_amount_exceeds_limit", status: 400 });
  });
});
