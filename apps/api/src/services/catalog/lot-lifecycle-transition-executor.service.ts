import type { Lot, StaffRoles, UserRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";
import type { ILotLifecycleTransitionExecutor } from "../interfaces/catalog-routes/catalog-lot-lifecycle-transition-executor.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { ISaleStatusTransitionService } from "../interfaces/sale-status-transition.js";

export class LotLifecycleTransitionExecutor implements ILotLifecycleTransitionExecutor {
  constructor(
    private readonly saleStatusTransitionService: ISaleStatusTransitionService,
    private readonly lotService: ILotService,
  ) {}

  applyStaffLotStatus(input: {
    role: UserRole | string;
    saleId: string;
    lotId: string;
    status: Parameters<ISaleStatusTransitionService["setLotStatus"]>[3];
    reason?: string;
    staffRoles?: StaffRoles | undefined;
  }): Promise<Result<Lot, LotError | AuthzError>> {
    return this.saleStatusTransitionService.setLotStatus(
      input.role,
      input.saleId,
      input.lotId,
      input.status,
      input.reason,
      input.staffRoles,
    );
  }

  cancelLot(input: {
    userId: string;
    role: UserRole | string;
    lotId: string;
    staffRoles?: StaffRoles | undefined;
    cancelReason: "admin_override" | "manual";
  }): Promise<Result<Lot, LotError | AuthzError>> {
    return this.lotService.cancel(
      input.userId,
      input.role,
      input.lotId,
      input.staffRoles,
      input.cancelReason,
    );
  }
}
