import type { Lot, Sale, StaffRoles } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

/** Admin publish / unpublish / cancel transitions for a sale and its lots. */
export interface ISalePublishService {
  publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>>;

  unpublish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Sale, LotError | AuthzError>>;

  cancel(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Sale, LotError | AuthzError>>;
}
