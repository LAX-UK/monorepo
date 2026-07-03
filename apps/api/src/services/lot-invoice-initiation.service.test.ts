import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { IPlatformFeePolicy } from "./interfaces/platform-fee.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import { LotInvoiceInitiationService } from "./lot-invoice-initiation.service.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";

const tierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

const baseLot: Lot = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Blue Vase",
  status: "ended",
  winnerId: "buyer-1",
  buyerLegalEntityId: "00000000-0000-4000-8000-000000000010",
  sellerLegalEntityId: "00000000-0000-4000-8000-000000000020",
  saleId: "00000000-0000-4000-8000-000000000030",
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
} as Lot;

function buildService(
  overrides: {
    lots?: Partial<ILotRepository>;
    payments?: Partial<IPaymentWriteRepository>;
    settlement?: Partial<ISettlementCompliancePolicy>;
    legalEntities?: Partial<ILegalEntityRepository>;
    outbox?: Partial<INotificationOutboxService>;
    accounting?: Partial<IInvoiceAccountingProvider>;
    domainEvents?: Partial<IDomainEventSink>;
  } = {},
) {
  const stageDispatch = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const ensureInvoiceForPayment = vi.fn().mockResolvedValue({ ok: true });

  const service = new LotInvoiceInitiationService(
    {
      findById: vi.fn().mockResolvedValue(baseLot),
      ...overrides.lots,
    } as unknown as ILotRepository,
    {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ISaleRepository,
    {
      findOpenByLotAndBuyer: vi.fn().mockResolvedValue(null),
      findRefundedByLotAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "pay-new",
        lotId: baseLot.id,
        amount: "1250.00",
        createdAt: new Date("2026-06-26T12:00:00.000Z"),
      } as PaymentRecord),
      ...overrides.payments,
    } as unknown as IPaymentWriteRepository,
    {
      evaluate: vi.fn().mockResolvedValue({ hold: false, reason: null }),
      ...overrides.settlement,
    } as unknown as ISettlementCompliancePolicy,
    tierPolicy,
    {
      computePlatformFeeFromPence: vi.fn().mockResolvedValue("62.50"),
    } as unknown as IPlatformFeePolicy,
    {
      isConfigured: vi.fn().mockReturnValue(true),
      ensureInvoiceForPayment,
      ...overrides.accounting,
    } as unknown as IInvoiceAccountingProvider,
    {
      stageDispatch: overrides.outbox?.stageDispatch ?? stageDispatch,
    } as unknown as INotificationOutboxService,
    new NotificationFactory(),
    {
      publish: overrides.domainEvents?.publish ?? publish,
      withTx: vi.fn().mockReturnValue({ publish: overrides.domainEvents?.publish ?? publish }),
    } as IDomainEventSink,
    {
      ensureAwaitingPayment: vi.fn().mockResolvedValue(undefined),
      onPaymentCaptured: vi.fn().mockResolvedValue(undefined),
    },
    {
      findById: vi
        .fn()
        .mockResolvedValue({ id: "00000000-0000-4000-8000-000000000020", status: "active" }),
      ...overrides.legalEntities,
    } as unknown as ILegalEntityRepository,
    {
      findById: vi
        .fn()
        .mockResolvedValue({ id: "buyer-1", email: "buyer@example.com", name: "Buyer" }),
    } as unknown as IUserRepository,
  );

  return {
    service,
    stageDispatch: overrides.outbox?.stageDispatch ?? stageDispatch,
    publish: overrides.domainEvents?.publish ?? publish,
    ensureInvoiceForPayment,
  };
}

describe("LotInvoiceInitiationService.ensureForLot", () => {
  it("no-ops when an open payment already exists", async () => {
    const { service } = buildService({
      payments: {
        findOpenByLotAndBuyer: vi.fn().mockResolvedValue({ id: "pay-existing" }),
      },
    });
    const result = await service.ensureForLot(baseLot.id);
    expect(result).toEqual({
      created: false,
      reason: "payment_already_exists",
      paymentId: "pay-existing",
    });
  });

  it("no-ops when lot has no winner", async () => {
    const { service } = buildService({
      lots: {
        findById: vi.fn().mockResolvedValue({ ...baseLot, winnerId: null }),
      },
    });
    const result = await service.ensureForLot(baseLot.id);
    expect(result).toEqual({ created: false, reason: "no_winner" });
  });

  it("creates pending payment, stages payment_due with dueDate, and calls Xero", async () => {
    const { service, stageDispatch, publish, ensureInvoiceForPayment } = buildService();
    const result = await service.ensureForLot(baseLot.id);
    expect(result.created).toBe(true);
    expect(result.paymentId).toBe("pay-new");
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "buyer-1",
        idempotencyKey: "payment_due:pay-new",
        payload: expect.objectContaining({
          type: "payment_due",
          meta: expect.objectContaining({
            dueDate: expect.stringMatching(/2026/),
            amount: "1250.00",
          }),
        }),
      }),
    );
    expect(publish).not.toHaveBeenCalled();
    expect(ensureInvoiceForPayment).toHaveBeenCalled();
  });

  it("creates requires_manual_review and publishes event without payment_due", async () => {
    const { service, stageDispatch, publish } = buildService({
      settlement: {
        evaluate: vi.fn().mockResolvedValue({ hold: true, reason: "aml_hold" }),
      },
    });
    const result = await service.ensureForLot(baseLot.id);
    expect(result.created).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.requires_manual_review" }),
    );
    expect(stageDispatch).not.toHaveBeenCalled();
  });

  it("returns created:false on open-payment unique violation race", async () => {
    const { service } = buildService({
      payments: {
        create: vi.fn().mockRejectedValue({
          code: "23505",
          message: 'duplicate key value violates unique constraint "payment_lot_buyer_open_unique"',
        }),
        findOpenByLotAndBuyer: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "pay-raced" }),
      },
    });
    const result = await service.ensureForLot(baseLot.id);
    expect(result).toEqual({
      created: false,
      reason: "payment_already_exists",
      paymentId: "pay-raced",
    });
  });
});
