import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { buildDashboardBidsBoardVm } from "@/lib/data/view-models/dashboard-bids.vm";
import { isAwaitingCheckout } from "@/lib/data/view-models/dashboard-portfolio.vm";
import type { PortfolioRow, UserNotification } from "@auction/types";
import type { ClientAttention } from "./client-attention";

export type ClientAttentionSources = {
  userId: string;
  bids: readonly BidWithLot[];
  purchases: readonly Pick<PortfolioRow, "payment">[];
  unreadNotifications: readonly Pick<UserNotification, "read">[];
  now: number;
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
  const { active } = buildDashboardBidsBoardVm([...sources.bids], sources.userId, sources.now);
  return {
    // The board orders bids by closing time, so the most urgent lot comes first.
    outbidLots: active.filter((row) => row.outbid).map((row) => lotLabel(row.lot?.lotNumber)),
    paymentsDue: sources.purchases.filter(isAwaitingCheckout).length,
    unreadNotifications: sources.unreadNotifications.filter((n) => !n.read).length,
  };
}
