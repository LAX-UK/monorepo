import type { IInvoiceRecipients } from "@auction/finance-runtime";
import type { IPaymentDomainEventsRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotFulfilmentPaymentHook } from "@auction/persistence/interfaces";
import type { IPaymentWriteRepository, PaymentRecord } from "@auction/persistence/interfaces";
import type { IAddressRepository } from "@auction/persistence/interfaces";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { PaymentStatus, StaffRoles } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError, PaymentProviderError } from "../lib/errors.js";
import type { IXeroPaymentRecorder } from "./accounting/xero-payment-recorder.js";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IBuyerPaymentAuthority } from "./interfaces/buyer-payment-authority.js";
import type { IStripeCheckoutService } from "./interfaces/checkout-rail.js";
import type { IErrorReporter } from "./interfaces/error-handling.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type {
  IPaymentAdminService,
  IPaymentBuyerService,
  IPaymentMaintenanceService,
} from "./interfaces/payment-service.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type { IPlatformFeePolicy } from "./interfaces/platform-fee.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";
import type { MyPaymentRowDTO } from "./payment-me-presenter.js";
import type { CheckoutOrchestratorDeps } from "./payment/checkout-orchestrator.js";
import { LegalEntityBuyerPaymentAuthority } from "./payment/legal-entity-buyer-payment-authority.js";
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
  refundBlockedCapture,
  reinstateBlockedCapture,
} from "./payment/payment-blocked-capture-ops.js";
import {
  type EntityWonLotDTO,
  cancelPendingAsBuyer,
  createPendingForWinner,
  getBuyerComplianceGateStatus,
  listEntityPaymentsForBuyerApi,
  listEntityWonLots,
  listForBuyer,
  listMyPaymentsForBuyerApi,
} from "./payment/payment-buyer-ops.js";
import {
  type IPaymentEligibilityGate,
  PaymentEligibilityGate,
} from "./payment/payment-eligibility.gate.js";
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
} from "./interfaces/payment-service.js";

/** Without a way to read accounts nobody can be shown to be a payer, so checkout stays closed. */
const REFUSE_ALL_PAYMENTS: IBuyerPaymentAuthority = {
  canPay: async () => ({ allowed: false, reason: "not_member" }),
};

/** Where the account's payers are not wired (tests of checkout itself), only the winner is told. */
const WINNER_ONLY: IInvoiceRecipients = {
  forInvoice: async ({ winnerUserId }) => [winnerUserId],
};

/** Without the account to read, nothing can be checked, so nothing is paid. */
const REFUSE_ALL_ELIGIBILITY: IPaymentEligibilityGate = {
  check: async () => ({ kind: "refused", reason: "organisation_closed" }),
};

export class PaymentService
  implements IPaymentBuyerService, IPaymentAdminService, IPaymentMaintenanceService
{
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
    transactionRunner?: import("@auction/persistence/interfaces").ITransactionRunner,
    domainEventSink?: IDomainEventSink,
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
    buyerPaymentAuthority: IBuyerPaymentAuthority | null = null,
    errorReporter: IErrorReporter | null = null,
    paymentEligibility: IPaymentEligibilityGate | null = null,
    invoiceRecipients: IInvoiceRecipients | null = null,
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
      errorReporter: errorReporter ?? undefined,
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
      transactionRunner,
      domainEventSink,
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
      buyerPaymentAuthority:
        buyerPaymentAuthority ??
        (legalEntityRepository
          ? new LegalEntityBuyerPaymentAuthority(legalEntityRepository)
          : REFUSE_ALL_PAYMENTS),
      paymentEligibility:
        paymentEligibility ??
        (legalEntityRepository
          ? new PaymentEligibilityGate(legalEntityRepository, null)
          : REFUSE_ALL_ELIGIBILITY),
      invoiceRecipients: invoiceRecipients ?? WINNER_ONLY,
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
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<PaymentRecord[], AuthzError>> {
    return listAllForAdmin(this.deps, userRole, userStaffRoles);
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

  listEntityPaymentsForBuyerApi(
    legalEntityId: string,
    options: { status?: PaymentStatus },
  ): Promise<{ data: MyPaymentRowDTO[] }> {
    return listEntityPaymentsForBuyerApi(this.deps, legalEntityId, options);
  }

  listEntityWonLots(
    legalEntityId: string,
    options: { limit: number; offset: number; includeHammerPrice: boolean },
  ): Promise<{ data: EntityWonLotDTO[] }> {
    return listEntityWonLots(this.deps, legalEntityId, options);
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
    userStaffRoles?: StaffRoles | undefined,
    staffReason?: string,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return refundPayment(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      actingLegalEntityId,
      userStaffRoles,
      staffReason,
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
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return markCapturedByAdmin(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      actingLegalEntityId,
      userStaffRoles,
    );
  }

  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<void, AuthzError>> {
    return releaseManualReviewForCapture(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      userStaffRoles,
    );
  }

  reinstateBlockedCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return reinstateBlockedCapture(this.deps, adminUserId, userRole, paymentId, userStaffRoles);
  }

  refundBlockedCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles: StaffRoles | undefined,
    reason?: string,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return refundBlockedCapture(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      userStaffRoles,
      reason,
    );
  }

  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
    reason?: string,
  ): Promise<Result<void, AuthzError | PaymentProviderError>> {
    return refundManualReviewPayment(
      this.deps,
      adminUserId,
      userRole,
      paymentId,
      userStaffRoles,
      reason,
    );
  }

  cancelPendingAsBuyer(
    buyerId: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError | LotError>> {
    return cancelPendingAsBuyer(this.deps, buyerId, paymentId);
  }

  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    return syncPaymentFromXeroAsAdmin(this.deps, userRole, paymentId, userStaffRoles);
  }
}
