import type { Lot, LotStatus, StaffRoles, UserRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../../lib/errors.js";

/** Staff HTTP and sale-scoped lot commands share this transition seam. */
export interface ILotLifecycleTransitionExecutor {
  applyStaffLotStatus(input: {
    role: UserRole | string;
    saleId: string;
    lotId: string;
    status: LotStatus;
    reason?: string;
    staffRoles?: StaffRoles | undefined;
  }): Promise<Result<Lot, LotError | AuthzError>>;

  cancelLot(input: {
    userId: string;
    role: UserRole | string;
    lotId: string;
    staffRoles?: StaffRoles | undefined;
    cancelReason: "admin_override" | "manual";
  }): Promise<Result<Lot, LotError | AuthzError>>;
}
