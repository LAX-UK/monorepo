import { groupMyBids } from "@/lib/bid/my-bid-status";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { groupBidderAttention } from "@auction/domain";
import type { UserNotification } from "@auction/types";
import type { ClientAttention } from "./client-attention";

export type ClientAttentionSources = {
  userId: string;
  bids: readonly BidWithLot[];
  /** Won lots still to pay that this person pays (see `purchasesToPayBy`). */
  purchasesToPay: readonly unknown[];
  unreadNotifications: readonly Pick<UserNotification, "read">[];
};

/** How a lot is named in a prompt: its catalogue number, or `null` before it has one. */
function lotLabel(lotNumber: number | null | undefined): string | null {
  return lotNumber == null ? null : String(lotNumber);
}

/**
 * Works out what is waiting for the person from their bids, purchases and inbox, using the
 * same rules as the My bids and Purchases pages, so the prompts never disagree with the pages.
 */
export function deriveClientAttention(sources: ClientAttentionSources): ClientAttention {
  const { active } = groupMyBids(sources.bids, sources.userId);
  // Outbid lots lead the Active view, soonest to close first.
  const outbid = active.filter((entry) => entry.status === "outbid");
  return {
    outbidLots: outbid.map((entry) => lotLabel(entry.row.lot?.lotNumber)),
    groups: groupBidderAttention(
      outbid.flatMap((entry) =>
        entry.row.lot
          ? [{ kind: "outbid" as const, lotId: entry.row.lot.id, title: entry.row.lot.title }]
          : [],
      ),
    ),
    paymentsDue: sources.purchasesToPay.length,
    unreadNotifications: sources.unreadNotifications.filter((n) => !n.read).length,
  };
}
