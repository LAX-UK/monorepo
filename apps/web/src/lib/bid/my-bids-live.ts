import { formatMoney } from "@/lib/format-currency";
import type { BidUpdateEvent } from "@auction/types";

export type LiveLotRef = { lotId: string; lotLabel: string | null; title: string };

function lotName(lot: LiveLotRef): string {
  return lot.lotLabel ? `lot ${lot.lotLabel}` : lot.title;
}

/**
 * What a screen reader hears when a lot on My bids changes: being outbid first, then the
 * person's own bid taking the lead, then any other new price. One short sentence each.
 */
export function bidUpdateAnnouncement(
  event: Pick<BidUpdateEvent, "currentPrice" | "outbidUserId" | "placedByUserId">,
  lot: LiveLotRef,
  userId: string,
): string {
  const price = formatMoney(event.currentPrice);
  if (event.outbidUserId === userId) return `You've been outbid on ${lotName(lot)}. Now ${price}.`;
  if (event.placedByUserId === userId) return `You're winning ${lotName(lot)} at ${price}.`;
  return `New bid on ${lotName(lot)}: ${price}.`;
}

export function lotClosedAnnouncement(lot: LiveLotRef): string {
  const name = lotName(lot);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} has closed.`;
}
