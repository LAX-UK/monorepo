import type { PaymentRecord } from "@auction/persistence/interfaces";
import type { PaymentStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError, PaymentProviderError } from "../../lib/errors.js";
import type { MyPaymentRowDTO } from "../payment-me-presenter.js";
import type { CreatePendingPaymentResult } from "../payment/payment-service-types.js";

export type { CreatePendingPaymentResult } from "../payment/payment-service-types.js";

export interface IPaymentBuyerService {
  createPendingForWinner(
    buyerId: string,
    lotId: string,
    addressId: string,
  ): Promise<Result<CreatePendingPaymentResult, AuthzError | LotError | PaymentProviderError>>;

  listForBuyer(buyerId: string): Promise<PaymentRecord[]>;

  listMyPaymentsForBuyerApi(
    userId: string,
    options: { status?: PaymentStatus },
  ): Promise<{ data: MyPaymentRowDTO[] }>;

  getBuyerComplianceGateStatus(
    userId: string,
  ): Promise<{ status: "clear" | "aml_hold" | "source_of_funds_required" }>;

  cancelPendingAsBuyer(
    buyerId: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError | LotError>>;
}

export interface IPaymentAdminService {
  listAllForAdmin(
    userRole: string,
    userStaffRole?: string | null,
  ): Promise<Result<PaymentRecord[], AuthzError>>;

  markCapturedByAdmin(
    adminUserId: string | null | undefined,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>>;

  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>>;

  refundPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    actingLegalEntityId?: string | null,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>>;

  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError | PaymentProviderError>>;

  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>>;
}

export interface IPaymentMaintenanceService {
  countPendingOlderThanHours(hours: number): Promise<number>;

  sumCapturedBetween(start: Date, end: Date): Promise<string>;

  backfillXeroInvoiceForPayment(paymentId: string): Promise<{ ok: boolean; error?: string }>;

  expireStalePendingPayments(
    pendingMaxAgeDays: number,
    authorizedMaxAgeDays?: number,
  ): Promise<number>;
}

export interface IPaymentService
  extends IPaymentBuyerService,
    IPaymentAdminService,
    IPaymentMaintenanceService {}
