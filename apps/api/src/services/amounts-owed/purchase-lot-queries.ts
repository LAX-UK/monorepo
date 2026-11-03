import type { Lot } from "@auction/types";

/**
 * A won lot becomes a purchase only once it has ended. A leader on a lot that is still open
 * (whatever `winnerId` holds at that moment) owes nothing yet, so open lots never reach
 * Purchases, the amounts owed, or the menu counts that read them.
 */
export const PURCHASE_LOT_STATUSES: Lot["status"][] = ["ended"];

/** Which won lots a person's own purchases list reads. */
export function personalPurchaseLots(userId: string, limit: number) {
  return { winnerId: userId, statuses: PURCHASE_LOT_STATUSES, limit, offset: 0 };
}

/**
 * Which won lots an organisation's purchases list reads: all of them for the members who see its
 * money, their own wins for buyer agents.
 */
export function accountPurchaseLots(
  accountId: string,
  scope: "all" | "own",
  userId: string,
  limit: number,
) {
  return {
    buyerLegalEntityId: accountId,
    ...(scope === "own" ? { winnerId: userId } : {}),
    statuses: PURCHASE_LOT_STATUSES,
    limit,
    offset: 0,
  };
}
