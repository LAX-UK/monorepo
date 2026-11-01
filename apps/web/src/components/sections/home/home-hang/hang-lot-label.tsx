"use client";

import { useLiveLotBid } from "@/hooks/use-live-lot-bid";
import { useTabVisible } from "@/hooks/use-tab-visible";
import type { HangLabelModel } from "@/lib/hang/hang-label";
import { formatHangMoney } from "@/lib/hang/hang-money";
import { MarketingHangLabel } from "@auction/marketing-ui";

/**
 * A wall label that follows the price while the lot can take bids and the tab is in front. A new
 * price replaces the old one in place: no animation, no layout change. It joins the bidding room
 * only for lots the server marked live, so ended and upcoming lots never connect.
 */
export function HangLotLabel({ model }: { model: HangLabelModel }) {
  const visible = useTabVisible();
  const livePrice = useLiveLotBid(model.live?.lotId, visible);

  const price =
    model.live && livePrice !== null
      ? { qualifier: "Current bid", value: formatHangMoney(livePrice, model.live.currency) }
      : model.price;

  return (
    <MarketingHangLabel
      eyebrow={model.eyebrow}
      title={model.title}
      price={price}
      notes={model.notes}
    />
  );
}
