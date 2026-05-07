import type { Database } from "@auction/db";
import type { Lot } from "@auction/types";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { PaymentProviderError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IPaymentAccountingProvider } from "./interfaces/payment-accounting-provider.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { ILotRepository, IUserRepository } from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentService } from "./payment.service.js";
import type { IStripePaymentGateway } from "./stripe/stripe-payment-gateway.js";

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
  stripeChargeId: null,
  stripeRefundId: null,
  status: "pending",
  createdAt: new Date(),
};

function makeTxAndDb() {
  const tx = { insert: vi.fn(), update: vi.fn() } as unknown as Database;
  const db = {
    transaction: vi.fn(async (fn: (t: Database) => Promise<void>) => {
      await fn(tx);
    }),
  } as unknown as Database;
  return { tx, db };
}

describe("PaymentService", () => {
  it("routes captured-payment notifications to buyer and seller finance members", async () => {
    const { tx, db } = makeTxAndDb();
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(payment),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(undefined),
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
    const publisher: DomainEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const service = new PaymentService(
      lots,
      payments,
      dispatcher,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@x" }),
      } as unknown as IUserRepository,
      accounting,
      legalEntityRecipients,
      undefined,
      db,
      publisher,
      null,
    );

    const result = await service.markCapturedByAdmin(
      "admin-1",
      "accountant",
      payment.id,
      lot.sellerLegalEntityId,
    );

    expect(result.isOk()).toBe(true);
    expect(payments.applyCapturedInTransaction).toHaveBeenCalledWith(
      tx,
      payment.id,
      expect.any(Object),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "payment.captured",
        aggregateId: payment.id,
      }),
    );
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

  it("captures via Stripe before persisting when a payment intent is present", async () => {
    const { tx, db } = makeTxAndDb();
    const pay = {
      ...payment,
      stripePaymentIntentId: "pi_test_capture",
      stripeChargeId: null,
    };
    const stripe: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn().mockResolvedValue({
        latest_charge: "ch_from_pi",
        status: "succeeded",
      } as Stripe.PaymentIntent),
      createRefund: vi.fn(),
    };
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(pay)
        .mockResolvedValueOnce({
          ...pay,
          status: "captured" as const,
          stripeChargeId: "ch_from_pi",
        }),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;
    const publisher: DomainEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@x" }),
      } as unknown as IUserRepository,
      {
        isConfigured: vi.fn().mockReturnValue(false),
        getCheckoutUrlIfAny: vi.fn(),
        createCheckoutForWinner: vi.fn(),
        syncPaymentFromProvider: vi.fn(),
        syncInvoiceFromProvider: vi.fn(),
      },
      null,
      undefined,
      db,
      publisher,
      stripe,
    );

    const result = await service.markCapturedByAdmin("admin-1", "administrator", pay.id, undefined);

    expect(result.isOk()).toBe(true);
    expect(stripe.capturePaymentIntent).toHaveBeenCalledWith("pi_test_capture");
    expect(payments.applyCapturedInTransaction).toHaveBeenCalledWith(tx, pay.id, {
      stripeChargeId: "ch_from_pi",
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "payment.captured" }),
    );
  });

  it("does not update DB or emit payment.captured when Stripe capture fails", async () => {
    const { db } = makeTxAndDb();
    const pay = { ...payment, stripePaymentIntentId: "pi_bad" };
    const stripeErr = new Stripe.errors.StripeInvalidRequestError({
      message: "cannot capture",
      type: "invalid_request_error",
      code: "payment_intent_unusable",
    } as never);
    const stripe: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn().mockRejectedValue(stripeErr),
      createRefund: vi.fn(),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyCapturedInTransaction: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const publisher: DomainEventPublisher = { publish: vi.fn() } as unknown as DomainEventPublisher;
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
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
      db,
      publisher,
      stripe,
    );

    const result = await service.markCapturedByAdmin("admin-1", "administrator", pay.id, undefined);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const e = result.error;
      expect(e).toBeInstanceOf(PaymentProviderError);
      expect((e as PaymentProviderError).stripeCode).toBe("payment_intent_unusable");
    }
    expect(db.transaction).not.toHaveBeenCalled();
    expect(payments.applyCapturedInTransaction).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("calls Stripe refund before DB and emits payment.refunded only after success", async () => {
    const order: string[] = [];
    const { tx, db } = makeTxAndDb();
    const pay = { ...payment, stripeChargeId: "ch_refund_me", status: "captured" as const };
    const stripe: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn().mockImplementation(async () => {
        order.push("stripe_refund");
        return { kind: "created" as const, refundId: "re_abc" };
      }),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyRefundedInTransaction: vi.fn().mockImplementation(async () => {
        order.push("db_refund");
      }),
    } as unknown as IPaymentWriteRepository;
    const publisher: DomainEventPublisher = {
      publish: vi.fn().mockImplementation(async () => {
        order.push("event");
      }),
    } as unknown as DomainEventPublisher;

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
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment("admin-1", "administrator", pay.id, undefined);
    expect(result.isOk()).toBe(true);
    expect(stripe.createRefund).toHaveBeenCalledWith({
      chargeId: "ch_refund_me",
      amount: 12_500,
      reason: "requested_by_customer",
    });
    expect(order).toEqual(["stripe_refund", "db_refund", "event"]);
    expect(payments.applyRefundedInTransaction).toHaveBeenCalledWith(tx, pay.id, "re_abc");
    expect(publisher.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "payment.refunded" }),
    );
  });

  it("does not update DB when Stripe refund fails", async () => {
    const { db } = makeTxAndDb();
    const pay = { ...payment, stripeChargeId: "ch_x", status: "captured" as const };
    const stripe: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn().mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          message: "nope",
          type: "invalid_request_error",
          code: "resource_missing",
        } as never),
      ),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyRefundedInTransaction: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const publisher: DomainEventPublisher = { publish: vi.fn() } as unknown as DomainEventPublisher;

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
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment("admin-1", "administrator", pay.id, undefined);
    expect(result.isErr()).toBe(true);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(payments.applyRefundedInTransaction).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("persists refunded state when Stripe reports charge_already_refunded", async () => {
    const { tx, db } = makeTxAndDb();
    const pay = { ...payment, stripeChargeId: "ch_done", status: "captured" as const };
    const stripe: IStripePaymentGateway = {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund: vi.fn().mockResolvedValue({ kind: "already_refunded" as const }),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyRefundedInTransaction: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPaymentWriteRepository;
    const publisher: DomainEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;

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
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment("admin-1", "administrator", pay.id, undefined);
    expect(result.isOk()).toBe(true);
    expect(payments.applyRefundedInTransaction).toHaveBeenCalledWith(tx, pay.id, null);
    expect(publisher.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: "payment.refunded" }),
    );
  });

  it("rejects entity-scoped refunds for a different seller legal entity", async () => {
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(payment),
      applyRefundedInTransaction: vi.fn(),
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
    expect(payments.applyRefundedInTransaction).not.toHaveBeenCalled();
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
