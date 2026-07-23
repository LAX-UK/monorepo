import type {
  CreateNotificationRow,
  ILegalEntityRepository,
  ILotFulfilmentPaymentHook,
  ILotRepository,
  IPaymentWriteRepository,
  ISaleRepository,
  IUserRepository,
  NotificationPayload,
  PaymentRecord,
} from "@auction/persistence/interfaces";
import { computeLotCheckoutPricing } from "@auction/validators";
import { gbpAmountToPence, gbpPenceToMajorString } from "./decimal-money.js";
import type { DomainEventPublishInput } from "./domain-event-sink-port.js";
import { ensureXeroInvoiceForPayment } from "./ensure-xero-invoice.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import { isOpenPaymentUniqueViolation } from "./is-open-payment-unique-violation.js";
import { formatPaymentDueDateFromCreated } from "./payment-due-date.js";
import type { PaymentTierPolicy } from "./payment-tier.policy.js";
import type { IPlatformFeePolicy } from "./platform-fee.policy.js";
import { resolveNewPaymentReviewDecision } from "./resolve-new-payment-review.js";
import type { ISettlementCompliancePolicy } from "./settlement-compliance.policy.js";

export type EnsureLotInvoiceResult = {
  created: boolean;
  reason?: string;
  paymentId?: string;
  lotId?: string;
  error?: string;
};

export interface ILotInvoiceNotificationOutbox {
  stageDispatch(input: {
    userId: string;
    payload: NotificationPayload;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface ILotInvoiceNotificationFactory {
  createPaymentDue(
    lot: import("@auction/types").Lot,
    buyerId: string,
    input: { paymentId: string; amount: string; checkoutUrl: string | null; dueDate?: string },
  ): CreateNotificationRow;
}

export function notificationRowToPayload(row: CreateNotificationRow): NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    ...(row.meta != null ? { meta: row.meta } : {}),
  };
}

export interface ILotInvoiceDomainEventPublisher {
  publish(event: DomainEventPublishInput): Promise<void>;
}

/** Idempotently ensure a payment row (+ invoice staging) exists for a sold lot. */
export class LotInvoiceInitiationService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly sales: ISaleRepository,
    private readonly payments: IPaymentWriteRepository,
    private readonly settlementCompliance: ISettlementCompliancePolicy | null,
    private readonly paymentTierPolicy: PaymentTierPolicy,
    private readonly platformFeePolicy: IPlatformFeePolicy,
    private readonly accounting: IInvoiceAccountingProvider,
    private readonly notificationOutbox: ILotInvoiceNotificationOutbox,
    private readonly notificationFactory: ILotInvoiceNotificationFactory,
    private readonly domainEventSink: ILotInvoiceDomainEventPublisher,
    private readonly lotFulfilmentHooks: ILotFulfilmentPaymentHook | null,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly users: IUserRepository,
    private readonly xeroWritesDisabled?: boolean,
  ) {}

  async ensureForLot(lotId: string): Promise<EnsureLotInvoiceResult> {
    if (this.xeroWritesDisabled) {
      return { created: false, reason: "xero_api_writes_disabled", lotId };
    }

    const lot = await this.lots.findById(lotId);
    if (!lot) {
      return { created: false, reason: "lot_not_found", lotId };
    }
    if (lot.status !== "ended") {
      return { created: false, reason: "lot_not_ended", lotId };
    }
    if (!lot.winnerId) {
      return { created: false, reason: "no_winner", lotId };
    }
    if (!lot.buyerLegalEntityId) {
      return { created: false, reason: "missing_buyer_legal_entity", lotId };
    }
    if (!lot.sellerLegalEntityId) {
      return { created: false, reason: "missing_seller_legal_entity", lotId };
    }

    const buyerId = lot.winnerId;

    const existing = await this.payments.findOpenByLotAndBuyer(lotId, buyerId);
    if (existing) {
      return { created: false, reason: "payment_already_exists", paymentId: existing.id, lotId };
    }

    const priorRefund = await this.payments.findRefundedByLotAndBuyer(lotId, buyerId);
    if (priorRefund) {
      return { created: false, reason: "already_refunded", paymentId: priorRefund.id, lotId };
    }

    const sale = lot.saleId ? await this.sales.findById(lot.saleId) : null;
    const pricing = computeLotCheckoutPricing(lot, sale);
    const amountPence = gbpAmountToPence(pricing.totalMajor);
    const amount = gbpPenceToMajorString(amountPence);

    const amountValidation = this.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
    if (amountValidation === "blocked") {
      return { created: false, reason: "payment_amount_exceeds_limit", lotId };
    }
    if (amountValidation === "invalid_amount") {
      return { created: false, reason: "invalid_payment_amount", lotId };
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
          lotId,
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
      return { created: true, paymentId: created.id, lotId };
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
      /* invoice deferred — payment row exists */
    }

    return { created: true, paymentId: created.id, lotId };
  }
}
