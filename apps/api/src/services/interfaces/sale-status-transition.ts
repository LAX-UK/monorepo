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
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>>;

  /** Cancel a single lot within a draft or scheduled sale. Useful when an admin
   * pulls a single lot pre-publication or before a scheduled sale opens.
   */
  cancelLot(
    userRole: string,
    saleId: string,
    lotId: string,
    reason?: string,
  ): Promise<Result<Lot, LotError | AuthzError>>;

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
  ): Promise<Result<Lot, LotError | AuthzError>>;
}
