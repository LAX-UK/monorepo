import type { Database } from "@auction/db";
import type { Lot, Sale } from "@auction/types";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { LotError, PaymentProviderError } from "../lib/errors.js";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IStripeCheckoutService } from "./interfaces/checkout-rail.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { IAddressRepository } from "./interfaces/profile.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentService } from "./payment.service.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";
import type { IStripePaymentGateway } from "./stripe/stripe-payment-gateway.js";

const CHECKOUT_ADDRESS_ID = "00000000-0000-4000-8000-0000000000a1";

function mockCheckoutAddresses(): IAddressRepository {
  return {
    findByIdForUser: vi.fn().mockResolvedValue({
      id: CHECKOUT_ADDRESS_ID,
      userId: "buyer-1",
      label: "Home",
      line1: "1 Test St",
      line2: null,
      city: "London",
      state: null,
      postalCode: "SW1A 1AA",
      country: "GB",
      addressType: "both",
      isDefault: true,
      createdAt: new Date(),
    }),
  } as unknown as IAddressRepository;
}

const defaultTierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

function mockAccounting(
  overrides: Partial<IInvoiceAccountingProvider> = {},
): IInvoiceAccountingProvider {
  return {
    isConfigured: vi.fn().mockReturnValue(false),
    ensureInvoiceForPayment: vi.fn().mockResolvedValue({ ok: true }),
    syncPaymentFromProvider: vi.fn(),
    syncInvoiceFromProvider: vi.fn(),
    ...overrides,
  };
}

function mockStripeCheckout(
  overrides: Partial<IStripeCheckoutService> = {},
): IStripeCheckoutService {
  return {
    isAvailable: () => true,
    createCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/test",
      checkoutRail: "card",
    }),
    ...overrides,
  };
}

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

function makeDelegatingPaymentCapture(
  db: Database,
  payments: IPaymentWriteRepository,
  publisher: DomainEventPublisher,
): IPaymentCaptureService {
  return {
    capture: vi.fn().mockImplementation(async (input) => {
      const apply = async (tx: Database) => {
        const opts: { stripeChargeId?: string } = {};
        if (input.stripeChargeId) opts.stripeChargeId = input.stripeChargeId;
        await payments.applyCapturedInTransaction?.(tx, input.paymentId, opts);
        await publisher.publish(tx, {
          aggregateType: "payment",
          aggregateId: input.paymentId,
          eventType: "payment.captured",
          payload: { paymentId: input.paymentId },
          actorUserId: input.actorUserId ?? null,
          actingLegalEntityId: null,
        });
      };
      if (input.tx) await apply(input.tx);
      else await db.transaction(apply);
    }),
  };
}
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
    const accounting = mockAccounting();
    const publisher: DomainEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher;
    const paymentCapture = makeDelegatingPaymentCapture(db, payments, publisher);
    const service = new PaymentService(
      lots,
      payments,
      dispatcher,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@x" }),
      } as unknown as IUserRepository,
      accounting,
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      paymentCapture,
    );

    const result = await service.markCapturedByAdmin(
      "admin-1",
      "staff",
      payment.id,
      lot.sellerLegalEntityId,
      "finance_ops",
    );

    expect(result.isOk()).toBe(true);
    expect(paymentCapture.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: payment.id,
        via: "admin_manual",
        actorUserId: "admin-1",
      }),
    );
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
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
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
    const paymentCapture = makeDelegatingPaymentCapture(db, payments, publisher);
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@x" }),
      } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      stripe,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      paymentCapture,
    );

    const result = await service.markCapturedByAdmin(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );

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
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
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
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      stripe,
    );

    const result = await service.markCapturedByAdmin(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );

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
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyRefundedInTransaction: vi.fn().mockImplementation(async () => {
        order.push("db_refund");
        return true;
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
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );
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
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
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
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );
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
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
    };
    const payments = {
      findById: vi.fn().mockResolvedValue(pay),
      applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
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
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db,
      publisher,
      stripe,
    );

    const result = await service.refundPayment(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );
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
    const accounting = mockAccounting();
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      accounting,
      defaultTierPolicy,
    );

    const result = await service.refundPayment(
      "finance-1",
      "staff",
      payment.id,
      "00000000-0000-4000-8000-000000000099",
      "finance_ops",
    );

    expect(result.isErr()).toBe(true);
    expect(payments.applyRefundedInTransaction).not.toHaveBeenCalled();
  });

  it("creates manual-review payment and skips checkout when seller entity is archived", async () => {
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ...payment,
        id: "pay-review",
        status: "requires_manual_review",
      }),
    } as unknown as IPaymentWriteRepository;
    const accounting = mockAccounting({ isConfigured: vi.fn().mockReturnValue(true) });
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
      defaultTierPolicy,
      legalEntities,
      {} as never,
      publisher as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );

    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);

    expect(result.isOk()).toBe(true);
    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "requires_manual_review" }),
    );
    expect(accounting.ensureInvoiceForPayment).not.toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "payment.requires_manual_review",
        payload: expect.objectContaining({ reason: "seller_archived" }),
      }),
    );
  });

  it("preserves the compliance reason on an existing manual-review payment", async () => {
    const existingReview = {
      ...payment,
      id: "pay-review",
      status: "requires_manual_review",
    } as PaymentRecord;
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(existingReview),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
    } as unknown as IPaymentWriteRepository;
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "source_of_funds_required" }),
    };
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      { findById: vi.fn() } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
      settlementCompliance,
    );

    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.manualReviewReason).toBe("source_of_funds_required");
    }
    expect(settlementCompliance.evaluate).toHaveBeenCalled();
  });

  it("blocks release for capture when settlement compliance holds (AML)", async () => {
    const manualReviewPayment = {
      ...payment,
      id: "pay-aml-hold",
      status: "requires_manual_review",
      buyerId: "buyer-1",
    } as PaymentRecord;
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(manualReviewPayment),
      updateStatus: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "aml_hold" }),
    };
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
      settlementCompliance,
    );

    const result = await service.releaseManualReviewForCapture(
      "finance-1",
      "staff",
      manualReviewPayment.id,
      "finance_ops",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(403);
      expect(result.error.code).toBe("payment_release_blocked_aml_hold");
    }
    expect(payments.updateStatus).not.toHaveBeenCalled();
    expect(settlementCompliance.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ excludePaymentId: "pay-aml-hold" }),
    );
  });

  it("blocks release for capture when source-of-funds is required", async () => {
    const manualReviewPayment = {
      ...payment,
      status: "requires_manual_review",
      buyerId: "buyer-1",
    } as PaymentRecord;
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue(manualReviewPayment),
      updateStatus: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const settlementCompliance: ISettlementCompliancePolicy = {
      evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "source_of_funds_required" }),
    };
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
      settlementCompliance,
    );

    const result = await service.releaseManualReviewForCapture(
      "finance-1",
      "staff",
      payment.id,
      "finance_ops",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("payment_release_blocked_source_of_funds");
    }
    expect(payments.updateStatus).not.toHaveBeenCalled();
  });

  it("refunds a manual-review payment even when seller is archived", async () => {
    const tx = {} as never;
    const db = {
      transaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)),
    };
    const payments: IPaymentWriteRepository = {
      findById: vi.fn().mockResolvedValue({ ...payment, status: "requires_manual_review" }),
      applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
    } as unknown as IPaymentWriteRepository;
    const publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = new PaymentService(
      { findById: vi.fn() } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      db as never,
      publisher as never,
    );

    const result = await service.refundManualReviewPayment(
      "admin-1",
      "staff",
      payment.id,
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    expect(payments.applyRefundedInTransaction).toHaveBeenCalledWith(tx, payment.id, null);
    expect(publisher.publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "payment.refunded",
        payload: expect.objectContaining({ reason: "seller_archived" }),
      }),
    );
  });

  it("applies sale-level tier override to total when present (tier band switches at threshold)", async () => {
    const tieredLot: Lot = {
      ...lot,
      saleId: "sale-tier",
      currentPrice: "499999.99",
      buyerPremiumRate: "0.1000",
    };
    const saleWithTiers: Sale = {
      id: "sale-tier",
      title: "Tiered Sale",
      description: null,
      coverImages: [],
      categoryId: null,
      deliveryMode: "online",
      streamUrl: null,
      locationName: null,
      locationAddress: null,
      locationMapUrl: null,
      locationAddressLine1: null,
      locationAddressLine2: null,
      locationCity: null,
      locationCounty: null,
      locationPostcode: null,
      locationCountry: null,
      status: "scheduled",
      startTime: new Date(),
      endTime: new Date(),
      previewStartTime: null,
      buyerPremiumRate: "0.1500",
      buyerPremiumTiers: [
        { hammerThresholdMinor: 0, rate: "0.1500" },
        { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
      ],
      terms: null,
      createdBy: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...payment, id: "pay-tier", status: "pending" }),
    } as unknown as IPaymentWriteRepository;
    const accounting = mockAccounting();
    const publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const legalEntities: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue({ id: tieredLot.sellerLegalEntityId, status: "active" }),
    } as unknown as ILegalEntityRepository;
    const sales: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(saleWithTiers),
    } as unknown as ISaleRepository;

    const stripeCheckout = mockStripeCheckout({
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: "https://checkout.stripe.com/bank",
        checkoutRail: "gb_bank_transfer",
      }),
    });
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(tieredLot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" }),
      } as unknown as IUserRepository,
      accounting,
      defaultTierPolicy,
      legalEntities,
      {} as never,
      publisher as never,
      null,
      undefined,
      undefined,
      sales,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );

    const result = await service.createPendingForWinner(
      "buyer-1",
      tieredLot.id,
      CHECKOUT_ADDRESS_ID,
    );
    expect(result.isOk()).toBe(true);
    // Hammer 499_999.99 → tier @ 0 → 15% → banker's-rounded premium = 75000.00
    // Without tiers the lot's flat 10% would have produced 549999.99 → we assert the tier wins.
    expect(payments.create).toHaveBeenCalledWith(expect.objectContaining({ amount: "574999.99" }));
    expect(sales.findById).toHaveBeenCalledWith("sale-tier");
  });

  it("listMyPaymentsForBuyerApi filters by status and includes presented rows", async () => {
    const pendingP: PaymentRecord = { ...payment, id: "pay-p", status: "pending" };
    const capturedP: PaymentRecord = { ...payment, id: "pay-c", status: "captured" };
    const payments: IPaymentWriteRepository = {
      listByBuyerId: vi.fn().mockResolvedValue([pendingP, capturedP]),
    } as unknown as IPaymentWriteRepository;
    const lots: ILotRepository = {
      findById: vi.fn().mockImplementation((id: string) => (id === lot.id ? lot : null)),
    } as unknown as ILotRepository;
    const accounting = mockAccounting();
    const service = new PaymentService(
      lots,
      payments,
      null,
      new NotificationFactory(),
      {} as IUserRepository,
      accounting,
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      null,
      undefined,
    );
    const out = await service.listMyPaymentsForBuyerApi("buyer-1", { status: "pending" });
    expect(out.data).toHaveLength(1);
    expect(out.data[0]?.id).toBe("pay-p");
    expect(out.data[0]?.lotTitle).toBe("Blue Study");
    expect(out.data[0]?.checkoutRail).toBe("card");
    expect(payments.listByBuyerId).toHaveBeenCalledWith("buyer-1");
  });

  it("returns 400 when amount exceeds absolute online limit", async () => {
    const blockedLot: Lot = {
      ...lot,
      currentPrice: "800000.00",
      buyerPremiumRate: "0.25",
    };
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    } as unknown as IPaymentWriteRepository;
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(blockedLot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      { findById: vi.fn() } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner(
      "buyer-1",
      blockedLot.id,
      CHECKOUT_ADDRESS_ID,
    );
    expect(result.isErr()).toBe(true);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it("creates high-value manual review without Xero or Stripe calls", async () => {
    const highLot: Lot = { ...lot, currentPrice: "400000.00", buyerPremiumRate: "0.25" };
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ...payment,
        id: "pay-hv",
        amount: "500000.00",
        status: "requires_manual_review",
      }),
    } as unknown as IPaymentWriteRepository;
    const accounting = mockAccounting({ isConfigured: vi.fn().mockReturnValue(true) });
    const stripeCheckout = mockStripeCheckout();
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(highLot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      { findById: vi.fn() } as unknown as IUserRepository,
      accounting,
      defaultTierPolicy,
      {
        findById: vi.fn().mockResolvedValue({ status: "active" }),
      } as unknown as ILegalEntityRepository,
      {} as never,
      { publish: vi.fn() } as never,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner("buyer-1", highLot.id, CHECKOUT_ADDRESS_ID);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.checkoutUrl).toBeNull();
      expect(result.value.manualReviewReason).toBe("high_value");
    }
    expect(accounting.ensureInvoiceForPayment).not.toHaveBeenCalled();
    expect(stripeCheckout.createCheckout).not.toHaveBeenCalled();
  });

  it("returns 503 when Xero invoice fails before Stripe checkout", async () => {
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...payment, id: "pay-xero", status: "pending" }),
    } as unknown as IPaymentWriteRepository;
    const accounting = mockAccounting({
      isConfigured: vi.fn().mockReturnValue(true),
      ensureInvoiceForPayment: vi.fn().mockResolvedValue({ ok: false, error: "xero down" }),
    });
    const stripeCheckout = mockStripeCheckout();
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" }),
      } as unknown as IUserRepository,
      accounting,
      defaultTierPolicy,
      {
        findById: vi.fn().mockResolvedValue({ status: "active" }),
      } as unknown as ILegalEntityRepository,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(PaymentProviderError);
      expect((result.error as PaymentProviderError).stripeCode).toBe("accounting_unavailable");
    }
    expect(stripeCheckout.createCheckout).not.toHaveBeenCalled();
  });

  it("issues bank transfer checkout for released manual-review pending payment", async () => {
    const highAmount = "600000.00";
    const pendingPayment: PaymentRecord = {
      ...payment,
      id: "pay-released",
      amount: highAmount,
      status: "pending",
    };
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(pendingPayment),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
    } as unknown as IPaymentWriteRepository;
    const stripeCheckout = mockStripeCheckout({
      createCheckout: vi.fn().mockResolvedValue({
        checkoutUrl: "https://checkout.stripe.com/bank",
        checkoutRail: "gb_bank_transfer",
      }),
    });
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" }),
      } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      {
        findById: vi.fn().mockResolvedValue({ status: "active" }),
      } as unknown as ILegalEntityRepository,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.checkoutRail).toBe("gb_bank_transfer");
      expect(result.value.checkoutUrl).toContain("checkout.stripe.com");
    }
  });

  it("does not re-issue Stripe checkout when an existing payment is already captured", async () => {
    const capturedPayment: PaymentRecord = {
      ...payment,
      id: "pay-captured",
      status: "captured",
    };
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(capturedPayment),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
    } as unknown as IPaymentWriteRepository;
    const stripeCheckout = mockStripeCheckout();
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" }),
      } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.paymentId).toBe("pay-captured");
      expect(result.value.checkoutUrl).toBeNull();
      expect(result.value.checkoutRail).toBeNull();
    }
    expect(stripeCheckout.createCheckout).not.toHaveBeenCalled();
  });

  it("blocks creating a new payment when a prior refund exists for the lot", async () => {
    const payments: IPaymentWriteRepository = {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue({
        ...payment,
        id: "pay-refunded",
        status: "refunded",
      }),
    } as unknown as IPaymentWriteRepository;
    const stripeCheckout = mockStripeCheckout();
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(lot) } as unknown as ILotRepository,
      payments,
      null,
      new NotificationFactory(),
      {
        findById: vi.fn().mockResolvedValue({ name: "Bob", email: "bob@test.com" }),
      } as unknown as IUserRepository,
      mockAccounting(),
      defaultTierPolicy,
      undefined,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stripeCheckout,
      undefined,
      undefined,
      undefined,
      mockCheckoutAddresses(),
    );
    const result = await service.createPendingForWinner("buyer-1", lot.id, CHECKOUT_ADDRESS_ID);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect((result.error as LotError).status).toBe(409);
    }
    expect(stripeCheckout.createCheckout).not.toHaveBeenCalled();
  });
});
