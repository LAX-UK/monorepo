import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IPaymentAccountingProvider } from "./interfaces/payment-accounting-provider.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { ILotRepository, IUserRepository } from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentService } from "./payment.service.js";

const lot: Lot = {
  id: "00000000-0000-4000-8000-000000000001",
  saleId: null,
  lotNumber: 1,
  sellerId: "legacy-seller",
  sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
  title: "Blue Study",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "00000000-0000-4000-8000-0000000000c0",
  auctionType: "english",
  startingPrice: "100.00",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "100.00",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1.00",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(),
  status: "ended",
  winnerId: "buyer-1",
  buyerLegalEntityId: "00000000-0000-4000-8000-000000000020",
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
};

const payment: PaymentRecord = {
  id: "pay-1",
  lotId: lot.id,
  buyerId: "buyer-1",
  sellerId: "legacy-seller",
  amount: "125.00",
  platformFee: "6.25",
  sellerLegalEntityId: lot.sellerLegalEntityId as string,
  stripePaymentIntentId: null,
  status: "pending",
  createdAt: new Date(),
};

describe("PaymentService", () => {
  it("routes captured-payment notifications to buyer and seller finance members", async () => {
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(payment),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;
    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
    } as unknown as ILotRepository;
    const dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationDispatcher;
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["owner-1", "finance-1"]),
    };
    const accounting: IPaymentAccountingProvider = {
      isConfigured: vi.fn().mockReturnValue(false),
      getCheckoutUrlIfAny: vi.fn(),
      createCheckoutForWinner: vi.fn(),
      syncPaymentFromProvider: vi.fn(),
      syncInvoiceFromProvider: vi.fn(),
    };
    const service = new PaymentService(
      lots,
      payments,
      dispatcher,
      new NotificationFactory(),
      {} as IUserRepository,
      accounting,
      legalEntityRecipients,
    );

    const result = await service.markCapturedByAdmin(
      "accountant",
      payment.id,
      lot.sellerLegalEntityId,
    );

    expect(result.isOk()).toBe(true);
    expect(legalEntityRecipients.listUserIdsForAudience).toHaveBeenCalledWith(
      lot.sellerLegalEntityId,
      "finance",
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "buyer-1",
      expect.objectContaining({ type: "payment_received" }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({ type: "payment_received" }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "finance-1",
      expect.objectContaining({ type: "payment_received" }),
    );
  });

  it("rejects entity-scoped refunds for a different seller legal entity", async () => {
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(payment),
      updateStatus: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const accounting: IPaymentAccountingProvider = {
      isConfigured: vi.fn().mockReturnValue(false),
      getCheckoutUrlIfAny: vi.fn(),
      createCheckoutForWinner: vi.fn(),
      syncPaymentFromProvider: vi.fn(),
      syncInvoiceFromProvider: vi.fn(),
    };
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      accounting,
    );

    const result = await service.refundPayment(
      "finance-1",
      "accountant",
      payment.id,
      "00000000-0000-4000-8000-000000000099",
    );

    expect(result.isErr()).toBe(true);
    expect(payments.updateStatus).not.toHaveBeenCalled();
  });

  it("creates manual-review payment and skips checkout when seller entity is archived", async () => {
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ...payment,
        id: "pay-review",
        status: "requires_manual_review",
      }),
    } as unknown as IPaymentWriteRepository;
    const accounting: IPaymentAccountingProvider = {
      isConfigured: vi.fn().mockReturnValue(true),
      getCheckoutUrlIfAny: vi.fn(),
      createCheckoutForWinner: vi.fn(),
      syncPaymentFromProvider: vi.fn(),
      syncInvoiceFromProvider: vi.fn(),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const legalEntities: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue({
        id: lot.sellerLegalEntityId,
        status: "archived",
      }),
    } as unknown as ILegalEntityRepository;
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      { findById: vi.fn() } as unknown as IUserRepository,
      accounting,
      null,
      legalEntities,
      {} as never,
      publisher as never,
    );

    const result = await service.createPendingForWinner("buyer-1", lot.id);

    expect(result.isOk()).toBe(true);
    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "requires_manual_review" }),
    );
    expect(accounting.createCheckoutForWinner).not.toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "payment.requires_manual_review",
        payload: expect.objectContaining({ reason: "seller_archived" }),
      }),
    );
  });

  it("refunds a manual-review payment even when seller is archived", async () => {
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue({ ...payment, status: "requires_manual_review" }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;
    const publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      {
        isConfigured: vi.fn().mockReturnValue(false),
        getCheckoutUrlIfAny: vi.fn(),
        createCheckoutForWinner: vi.fn(),
        syncPaymentFromProvider: vi.fn(),
        syncInvoiceFromProvider: vi.fn(),
      },
      null,
      undefined,
      {} as never,
      publisher as never,
    );

    const result = await service.refundManualReviewPayment("admin-1", "administrator", payment.id);

    expect(result.isOk()).toBe(true);
    expect(payments.updateStatus).toHaveBeenCalledWith(payment.id, "refunded");
    expect(publisher.publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "payment.refunded",
        payload: expect.objectContaining({ reason: "seller_archived" }),
      }),
    );
  });
});
