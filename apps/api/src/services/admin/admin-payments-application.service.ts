import type { Result } from "neverthrow";
import type { AuthzError } from "../../lib/errors.js";
import type { IAdminPaymentsApplicationService } from "../interfaces/admin-routes.js";
import type { PaymentService } from "../payment.service.js";

export class AdminPaymentsApplicationService implements IAdminPaymentsApplicationService {
  constructor(private readonly payments: PaymentService) {}

  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError>> {
    return this.payments.releaseManualReviewForCapture(adminUserId, userRole, paymentId);
  }

  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
  ): Promise<Result<void, AuthzError>> {
    return this.payments.refundManualReviewPayment(adminUserId, userRole, paymentId);
  }

  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    return this.payments.syncPaymentFromXeroAsAdmin(userRole, paymentId);
  }
}
