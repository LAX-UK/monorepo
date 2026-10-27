import type { DeletionBlocker } from "@auction/identity-contracts";
import type { IAccountDeletionEligibilityReader } from "@auction/persistence/interfaces";

/**
 * Stable codes for what LAX Bid can have in flight for a person. They are the same strings the
 * Bid delete endpoint has always returned, so existing clients keep matching on them.
 */
export const BID_DELETION_BLOCKER_CODES = {
  pendingPayments: "account_deletion_pending_payments",
  activeSellerLots: "account_deletion_active_seller_lots",
  openPayouts: "account_deletion_open_payouts",
} as const;

/**
 * What LAX Bid says to Identity when asked whether a person can delete their account: the
 * reasons it cannot yet, each with the Bid page that resolves it. Whether deletion has already
 * been requested is Identity's to say, so it is not repeated here.
 */
export class AccountDeletionEligibilityService {
  constructor(
    private readonly reader: IAccountDeletionEligibilityReader,
    /** Public origin of the Bid web app, which the blocker links point into. */
    private readonly webOrigin: string,
  ) {}

  async listBlockers(userId: string): Promise<DeletionBlocker[]> {
    const link = (path: string) => new URL(path, this.webOrigin).toString();
    const [hasPendingPayment, hasActiveSellerLot, entityIds] = await Promise.all([
      this.reader.hasPendingPayment(userId),
      this.reader.hasActiveSellerLot(userId),
      this.reader.listActiveMembershipEntityIds(userId),
    ]);
    const hasOpenPayout = await this.reader.hasOpenPayoutForEntities(entityIds);

    const blockers: DeletionBlocker[] = [];
    if (hasPendingPayment) {
      blockers.push({
        code: BID_DELETION_BLOCKER_CODES.pendingPayments,
        message: "You have a payment still to make. Pay it before deleting your account.",
        href: link("/purchases#payment-history"),
      });
    }
    if (hasActiveSellerLot) {
      blockers.push({
        code: BID_DELETION_BLOCKER_CODES.activeSellerLots,
        message:
          "You have lots in draft, scheduled or live in a sale. Withdraw them or wait until they finish.",
        href: link("/selling/consignments?tab=in-sale"),
      });
    }
    if (hasOpenPayout) {
      blockers.push({
        code: BID_DELETION_BLOCKER_CODES.openPayouts,
        message:
          "A payout to you or your organisation is still on its way. It needs to arrive first.",
        href: link("/selling/payouts"),
      });
    }
    return blockers;
  }
}
