import type { IEntityStaffPaymentApplicationService } from "../interfaces/finance-routes/finance-entity-staff-payment.js";
import type { IPaymentAdminService } from "../interfaces/payment-service.js";

export class EntityStaffPaymentApplicationService implements IEntityStaffPaymentApplicationService {
  constructor(private readonly payments: IPaymentAdminService) {}

  listAllForAdmin(...args: Parameters<IPaymentAdminService["listAllForAdmin"]>) {
    return this.payments.listAllForAdmin(...args);
  }

  markCapturedByAdmin(...args: Parameters<IPaymentAdminService["markCapturedByAdmin"]>) {
    return this.payments.markCapturedByAdmin(...args);
  }

  refundPayment(...args: Parameters<IPaymentAdminService["refundPayment"]>) {
    return this.payments.refundPayment(...args);
  }
}
