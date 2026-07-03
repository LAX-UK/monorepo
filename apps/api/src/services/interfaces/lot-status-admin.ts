import type { Lot, LotStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

/** Admin override of individual lot status within a sale (scheduled / ended). */
export interface ILotStatusAdminService {
  setLotStatus(
    userRole: string,
    saleId: string,
    lotId: string,
    status: LotStatus,
    reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;
}
