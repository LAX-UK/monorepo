import type { Database } from "@auction/db";
import type { PaymentStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError, PaymentProviderError } from "../lib/errors.js";
import type { IPaymentDomainEventsRepository } from "../repositories/interfaces/payment-domain-events.repository.js";
import type { IXeroPaymentRecorder } from "./accounting/xero-payment-recorder.js";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IStripeCheckoutService } from "./interfaces/checkout-rail.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotFulfilmentPaymentHook } from "./interfaces/lot-fulfilment-payment-hook.js";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPaymentService } from "./interfaces/payment-service.js";
import type { IPaymentWriteRepository, PaymentRecord } from "./interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IPlatformFeePolicy } from "./interfaces/platform-fee.js";
import type { IAddressRepository } from "./interfaces/profile.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "./interfaces/repositories.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";
import type { MyPaymentRowDTO } from "./payment-me-presenter.js";
import type { CheckoutOrchestratorDeps } from "./payment/checkout-orchestrator.js";
import {
  backfillXeroInvoiceForPayment,
  countPendingOlderThanHours,
  listAllForAdmin,
  markCapturedByAdmin,
  releaseManualReviewForCapture,
  sumCapturedBetween,
  syncPaymentFromXeroAsAdmin,
} from "./payment/payment-admin-ops.js";
import {
  cancelPendingAsBuyer,
  createPendingForWinner,
  expireStalePendingPayments,
  getBuyerComplianceGateStatus,
  listForBuyer,
  listMyPaymentsForBuyerApi,
} from "./payment/payment-buyer-ops.js";
import { refundManualReviewPayment, refundPayment } from "./payment/payment-refund-ops.js";
import type { PaymentRefundReconcileService } from "./payment/payment-refund-reconcile.service.js";
import type {
  CreatePendingPaymentResult,
  PaymentServiceDeps,
} from "./payment/payment-service-types.js";
import type { PaymentTierPolicy } from "./payment/payment-tier.policy.js";
import type { IStripePaymentGateway } from "./stripe/stripe-payment-gateway.js";

export type { CreatePendingPaymentResult } from "./payment/payment-service-types.js";
export type {
  IPaymentAdminService,
  IPaymentBuyerService,
  IPaymentMaintenanceService,
  IPaymentService,
} from "./interfaces/payment-service.js";

export class PaymentService implements IPaymentService {
  private readonly deps: PaymentServiceDeps;

  constructor(
    lots: ILotRepository,
    payments: IPaymentWriteRepository,
    notificationDispatcher: NotificationDispatcher | null,
    notificationFactory: NotificationFactory,
    users: IUserRepository,
    accounting: IInvoiceAccountingProvider,
    paymentTierPolicy: PaymentTierPolicy,
    legalEntityRepository?: ILegalEntityRepository,
    db?: Database,
    domainEventPublisher?: DomainEventPublisher,
    stripePayments: IStripePaymentGateway | null = null,
    mediaUrlResolver?: MediaUrlResolver,
    lotFulfilmentHooks: ILotFulfilmentPaymentHook | null = null,
    sales: ISaleRepository | null = null,
    _marketingEvents: IMarketingEventService | null = null,
    platformFeePolicy: IPlatformFeePolicy | null = null,
    paymentCapture: IPaymentCaptureService | null = null,
    stripeCheckout: IStripeCheckoutService | null = null,
    payoutAdjustments: IPayoutAdjustmentService | null = null,
    paymentRefundReconcile: PaymentRefundReconcileService | null = null,
    xeroPaymentRecorder: IXeroPaymentRecorder | null = null,
    addresses: IAddressRepository | null = null,
    settlementCompliance: ISettlementCompliancePolicy | null = null,
    xeroInvoiceBlocking = true,
    paymentDomainEvents: IPaymentDomainEventsRepository | null = null,
  ) {
    const checkoutOrchestratorDeps: CheckoutOrchestratorDeps = {
      payments,
      users,
      accounting,
      stripeCheckout,
      stripePayments,
      settlementCompliance,
      paymentTierPolicy,
      legalEntityRepository,
      paymentEvents: paymentDomainEvents ?? null,
      xeroInvoiceBlocking,
    };
    this.deps = {
      lots,
      payments,
      notificationDispatcher,
      notificationFactory,
      users,
      accounting,
      paymentTierPolicy,
      legalEntityRepository,
      db,
      domainEventPublisher,
      stripePayments,
      mediaUrlResolver,
      lotFulfilmentHooks,
      sales,
      platformFeePolicy,
      paymentCapture,
      stripeCheckout,
      payoutAdjustments,
      paymentRefundReconcile,
      xeroPaymentRecorder,
      addresses,
      settlementCompliance,
      xeroInvoiceBlocking,
      checkoutOrchestratorDeps,
    };
  }

  createPendingForWinner(
    buyerId: string,
    lotId: string,
    addressId: string,
  ): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>> {
    return createPendingForWinner(this.deps, buyerId, lotId, addressId);
  }

  listAllForAdmin(
    userRole: string,
    userStaffRole?: string | null,
  ): Promise<Result<PaymentRecord[], AuthzError>> {
    return listAllForAdmin(this.deps, userRole, userStaffRole);
  }

  listForBuyer(buyerId: string): Promise<PaymentRecord[]> {
    return listForBuyer(this.deps, buyerId);
  }

  listMyPaymentsForBuyerApi(
    userId: string,
    options: { status?: PaymentStatus },
  ): Promise<{ data: MyPaymentRowDTO[] }> {
    return listMyPaymentsForBuyerApi(this.deps, userId, options);
  }

  getBuyerComplianceGateStatus(
    userId: string,
  ): Promise<{ status: "clear" | "aml_hold" | "source_of_funds_required" }> {
    return getBuyerComplianceGateStatus(this.deps, userId);
  }

  countPendingOlderThanHours(hours: number): Promise<number> {
    return countPendingOlderThanHours(this.deps, hours);
  }

  sumCapturedBetween(start: Date, end: Date): Promise<string> {
    return sumCapturedBetween(this.deps, start, end);
  }

  refundPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return refundPayment(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      actingLegalEntityId,
      userStaffRole,
    );
  }

  backfillXeroInvoiceForPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    return backfillXeroInvoiceForPayment(this.deps, paymentId);
  }

  markCapturedByAdmin(
    adminUserId: string | null | undefined,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return markCapturedByAdmin(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      actingLegalEntityId,
      userStaffRole,
    );
  }

  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>> {
    return releaseManualReviewForCapture(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      userStaffRole,
    );
  }

  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return refundManualReviewPayment(this.deps, adminUserId, userRole, paymentId, userStaffRole);
  }

  cancelPendingAsBuyer(
    buyerId: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError | LotError>> {
    return cancelPendingAsBuyer(this.deps, buyerId, paymentId);
  }

  expireStalePendingPayments(
    pendingMaxAgeDays: number,
    authorizedMaxAgeDays?: number,
  ): Promise<number> {
    return expireStalePendingPayments(this.deps, pendingMaxAgeDays, authorizedMaxAgeDays);
  }

  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    return syncPaymentFromXeroAsAdmin(this.deps, userRole, paymentId, userStaffRole);
  }
}
