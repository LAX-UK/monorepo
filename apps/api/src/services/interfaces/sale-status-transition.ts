import type { Lot, LotStatus, Sale } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError } from "../../lib/errors.js";

/** Domain port for explicit, audit-friendly admin status transitions on a sale
 * and its child lots.
 * * Kept separate from {@link SaleService} (SRP): admin status orchestration is
 * a different concern from authoring drafts and managing lots, and from the
 * automatic reconciliation done by `SaleLifecycleService`.
 */
export interface ISaleStatusTransitionService {
  /** Manually mark an active onsite sale as ended. Ends all still-active lots
   * and cancels their lifecycle jobs. Online sales continue to use timed
   * lifecycle automation and reject this transition.
   */
  markOnsiteSaleEnded(
    userRole: string,
    saleId: string,
    reason?: string,
    userStaffRole?: string | null,
    actorUserId?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>>;

  /** Force a lot status change (admin override). Validates that the requested
   * transition is one of the allowed administrative paths so admins can't
   * accidentally regress a lot back into bidding.
   */
  setLotStatus(
    userRole: string,
    saleId: string,
    lotId: string,
    status: LotStatus,
    reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;
}
