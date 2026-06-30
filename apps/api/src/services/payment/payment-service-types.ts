import type { Database } from "@auction/db";
import type { IXeroPaymentRecorder } from "../accounting/xero-payment-recorder.js";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IStripeCheckoutService } from "../interfaces/checkout-rail.js";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotFulfilmentPaymentHook } from "../interfaces/lot-fulfilment-payment-hook.js";
import type { IPaymentCaptureService } from "../interfaces/payment-capture.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IPlatformFeePolicy } from "../interfaces/platform-fee.js";
import type { IAddressRepository } from "../interfaces/profile.js";
import type {
  ILotRepository,
  ISaleRepository,
  IUserRepository,
} from "../interfaces/repositories.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import type { CheckoutOrchestratorDeps } from "./checkout-orchestrator.js";
import type { PaymentRefundReconcileService } from "./payment-refund-reconcile.service.js";
import type { PaymentTierPolicy } from "./payment-tier.policy.js";
import type { CheckoutRailKind, ManualReviewReason } from "./payment-tier.policy.js";

export type CreatePendingPaymentResult = {
  paymentId: string;
  checkoutUrl: string | null;
  checkoutRail: CheckoutRailKind | null;
  manualReviewReason: ManualReviewReason | null;
};

/** Seller entity must not be in these states for refund. */
export const REFUND_BLOCKED_STATUSES = ["archived", "rejected"];

/** Resolved deps record built once in PaymentService constructor (post-default coalescing). */
export type PaymentServiceDeps = {
  lots: ILotRepository;
  payments: IPaymentWriteRepository;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
  users: IUserRepository;
  accounting: IInvoiceAccountingProvider;
  paymentTierPolicy: PaymentTierPolicy;
  legalEntityRepository: ILegalEntityRepository | undefined;
  db: Database | undefined;
  domainEventPublisher: DomainEventPublisher | undefined;
  stripePayments: IStripePaymentGateway | null;
  mediaUrlResolver: MediaUrlResolver | undefined;
  lotFulfilmentHooks: ILotFulfilmentPaymentHook | null;
  sales: ISaleRepository | null;
  platformFeePolicy: IPlatformFeePolicy | null;
  paymentCapture: IPaymentCaptureService | null;
  stripeCheckout: IStripeCheckoutService | null;
  payoutAdjustments: IPayoutAdjustmentService | null;
  paymentRefundReconcile: PaymentRefundReconcileService | null;
  xeroPaymentRecorder: IXeroPaymentRecorder | null;
  addresses: IAddressRepository | null;
  settlementCompliance: ISettlementCompliancePolicy | null;
  xeroInvoiceBlocking: boolean;
  checkoutOrchestratorDeps: CheckoutOrchestratorDeps;
};
