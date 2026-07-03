import { gbpAmountToPence, gbpPenceToMajorString } from "../lib/decimal-money.js";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotFulfilmentPaymentHook } from "./interfaces/lot-fulfilment-payment-hook.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { IPlatformFeePolicy } from "./interfaces/platform-fee.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationFactory } from "./notification.factory.js";
import { ensureXeroInvoiceForPayment } from "./payment/ensure-xero-invoice.js";
import { isOpenPaymentUniqueViolation } from "./payment/is-open-payment-unique-violation.js";
import { formatPaymentDueDateFromCreated } from "./payment/payment-due-date.js";
import type { PaymentTierPolicy } from "./payment/payment-tier.policy.js";
import { resolveNewPaymentReviewDecision } from "./payment/resolve-manual-review-reason.js";

export type EnsureLotInvoiceResult = {
  created: boolean;
  reason?: string;
  paymentId?: string;
};

/** Idempotently ensure a payment row (+ invoice staging) exists for a sold lot. */
export class LotInvoiceInitiationService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly sales: ISaleRepository,
    private readonly payments: IPaymentWriteRepository,
    private readonly settlementCompliance: ISettlementCompliancePolicy,
    private readonly paymentTierPolicy: PaymentTierPolicy,
    private readonly platformFeePolicy: IPlatformFeePolicy,
    private readonly accounting: IInvoiceAccountingProvider,
    private readonly notificationOutbox: INotificationOutboxService,
    private readonly notificationFactory: NotificationFactory,
    private readonly domainEventSink: IDomainEventSink,
    private readonly lotFulfilmentHooks: ILotFulfilmentPaymentHook | null,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly users: IUserRepository,
  ) {}

  async ensureForLot(lotId: string): Promise<EnsureLotInvoiceResult> {
    const lot = await this.lots.findById(lotId);
    if (!lot) {
      return { created: false, reason: "lot_not_found" };
    }
    if (lot.status !== "ended") {
      return { created: false, reason: "lot_not_ended" };
    }
    if (!lot.winnerId) {
      return { created: false, reason: "no_winner" };
    }
    if (!lot.buyerLegalEntityId) {
      return { created: false, reason: "missing_buyer_legal_entity" };
    }
    if (!lot.sellerLegalEntityId) {
      return { created: false, reason: "missing_seller_legal_entity" };
    }

    const buyerId = lot.winnerId;

    const existing = await this.payments.findOpenByLotAndBuyer(lotId, buyerId);
    if (existing) {
      return { created: false, reason: "payment_already_exists", paymentId: existing.id };
    }

    const priorRefund = await this.payments.findRefundedByLotAndBuyer(lotId, buyerId);
    if (priorRefund) {
      return { created: false, reason: "already_refunded", paymentId: priorRefund.id };
    }

    const sale = lot.saleId ? await this.sales.findById(lot.saleId) : null;
    const pricing = computeLotCheckoutPricing(lot, sale);
    const amountPence = gbpAmountToPence(pricing.totalMajor);
    const amount = gbpPenceToMajorString(amountPence);

    const amountValidation = this.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
    if (amountValidation === "blocked") {
      return { created: false, reason: "payment_amount_exceeds_limit" };
    }
    if (amountValidation === "invalid_amount") {
      return { created: false, reason: "invalid_payment_amount" };
    }

    const sellerLegalEntityId = lot.sellerLegalEntityId;
    const sellerEntity =
      this.legalEntityRepository && sellerLegalEntityId
        ? await this.legalEntityRepository.findById(sellerLegalEntityId)
        : null;
    const sellerArchived = sellerEntity?.status === "archived";

    const reviewDecision = await resolveNewPaymentReviewDecision({
      buyerUserId: buyerId,
      amountPence,
      sellerArchived,
      paymentTierPolicy: this.paymentTierPolicy,
      settlementCompliance: this.settlementCompliance,
    });

    if (reviewDecision.complianceHold && reviewDecision.manualReviewReason) {
      recordMoneyPathEvent(`settlement_compliance_hold_${reviewDecision.manualReviewReason}`);
    }

    const platformFee = await this.platformFeePolicy.computePlatformFeeFromPence(
      sellerLegalEntityId,
      amountPence,
    );

    let created: PaymentRecord;
    try {
      created = await this.payments.create({
        lotId,
        paidByUserId: buyerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        amount,
        platformFee,
        stripePaymentIntentId: null,
        status: reviewDecision.requiresManualReview ? "requires_manual_review" : "pending",
      });
    } catch (err) {
      if (isOpenPaymentUniqueViolation(err)) {
        const raced = await this.payments.findOpenByLotAndBuyer(lotId, buyerId);
        return {
          created: false,
          reason: "payment_already_exists",
          ...(raced?.id ? { paymentId: raced.id } : {}),
        };
      }
      throw err;
    }

    if (reviewDecision.requiresManualReview && reviewDecision.manualReviewReason) {
      await this.domainEventSink.publish({
        aggregateType: "payment",
        aggregateId: created.id,
        eventType: "payment.requires_manual_review",
        payload: {
          paymentId: created.id,
          lotId,
          buyerUserId: buyerId,
          buyerLegalEntityId: lot.buyerLegalEntityId,
          sellerLegalEntityId: lot.sellerLegalEntityId,
          amount,
          currency: "GBP",
          reason: reviewDecision.manualReviewReason,
        },
        actorUserId: buyerId,
        actingLegalEntityId: lot.buyerLegalEntityId,
      });
      return { created: true, paymentId: created.id };
    }

    await this.lotFulfilmentHooks?.ensureAwaitingPayment(lotId, created.id, null);

    const dueDate = formatPaymentDueDateFromCreated(created.createdAt);
    await this.notificationOutbox.stageDispatch({
      userId: buyerId,
      payload: notificationRowToPayload(
        this.notificationFactory.createPaymentDue(lot, buyerId, {
          paymentId: created.id,
          amount: created.amount,
          checkoutUrl: null,
          dueDate,
        }),
      ),
      idempotencyKey: `payment_due:${created.id}`,
    });

    const xeroResult = await ensureXeroInvoiceForPayment(
      this.accounting,
      this.users,
      created.id,
      lot,
      buyerId,
      created.amount,
    );
    if (!xeroResult.ok) {
      recordMoneyPathEvent("xero_invoice_deferred");
    }

    return { created: true, paymentId: created.id };
  }
}
