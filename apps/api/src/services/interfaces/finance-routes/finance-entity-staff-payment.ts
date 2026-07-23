import type { Result } from "neverthrow";
import type { AuthzError } from "../../../lib/errors.js";
import type { IPaymentAdminService } from "../payment-service.js";

export interface IEntityStaffPaymentApplicationService {
  listAllForAdmin: IPaymentAdminService["listAllForAdmin"];
  markCapturedByAdmin: IPaymentAdminService["markCapturedByAdmin"];
  refundPayment: IPaymentAdminService["refundPayment"];
}

export type EntityStaffPaymentCommandResult = Result<void, AuthzError>;
