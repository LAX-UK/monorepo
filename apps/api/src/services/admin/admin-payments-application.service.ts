import type { ListPaymentsAdminTableFilter } from "@auction/persistence/interfaces";
import type { StaffRoles } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError } from "../../lib/errors.js";
import type { IAdminPaymentsApplicationService } from "../interfaces/admin-routes.js";
import type { IPaymentAdminService } from "../interfaces/payment-service.js";
import type { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";

export class AdminPaymentsApplicationService implements IAdminPaymentsApplicationService {
  constructor(
    private readonly payments: IPaymentAdminService,
    private readonly paymentListQuery: AdminPaymentListQueryService,
  ) {}

  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<void, AuthzError>> {
    return this.payments.releaseManualReviewForCapture(
      adminUserId,
      userRole,
      paymentId,
      userStaffRoles,
    );
  }

  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
    reason?: string,
  ): Promise<Result<void, AuthzError>> {
    return this.payments.refundManualReviewPayment(
      adminUserId,
      userRole,
      paymentId,
      userStaffRoles,
      reason,
    );
  }

  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
    return this.payments.syncPaymentFromXeroAsAdmin(userRole, paymentId, userStaffRoles);
  }

  listPage(filter: ListPaymentsAdminTableFilter) {
    return this.paymentListQuery.getPage(filter);
  }
}
