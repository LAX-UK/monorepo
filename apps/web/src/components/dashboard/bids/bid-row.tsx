"use client";

import { MediaImage } from "@/components/ui/media-image";
import { RowStep } from "@/components/workspace/row-step";
import { BID_STATUS_BADGE } from "@/lib/bid/bid-status-badge";
import { bidNeedsYou } from "@/lib/bid/my-bid-status";
import { CLOSES_FIGURE_LABEL, type MyBidCardVm } from "@/lib/bid/my-bids.vm";
import { notify } from "@/lib/ui/notify";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { StatusBadge } from "@auction/ui/lax";
import { PlainLocalTime, useViewerMoment } from "@auction/ui/time";
import Link from "next/link";
import { useRouter } from "next/navigation";

async function copyLink(href: string) {
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    notify.success("Link copied");
  } catch {
    notify.error("We couldn't copy the link", { description: "Copy it from the lot page." });
  }
}

/**
 * One lot bid on, as a row: the work, who placed the bid, the three figures that say where it
 * stands, its status and the one next step. The lot, its bid history, other steps and the link
 * sit in the "…" menu, in the order every row menu uses.
 */
export function BidRow({
  card,
  onOpenHistory,
  bidBlockedReason,
}: {
  card: MyBidCardVm;
  onOpenHistory: (card: MyBidCardVm) => void;
  /** Set while the account may not bid: the step stays visible and says why it is off. */
  bidBlockedReason: string | null;
}) {
  const router = useRouter();
  const { href } = card;
  const menu: InlineActionMenuItem[] = href
    ? [
        { type: "item", label: "View lot", onSelect: () => router.push(href) },
        ...card.more.map((action) => ({
          type: "item" as const,
          label: action.label,
          onSelect: () => router.push(action.href),
        })),
        { type: "item", label: "Bid history", onSelect: () => onOpenHistory(card) },
        { type: "separator" },
        { type: "item", label: "Copy link", onSelect: () => void copyLink(href) },
      ]
    : [];
  const badge = BID_STATUS_BADGE[card.status];
  const next = card.next;
  const closing = useViewerMoment(card.closes?.iso ?? null, card.closes?.zone ?? "").moment;
  const ownTime = closing?.local ? <PlainLocalTime moment={closing} /> : null;
  const blocked = Boolean(bidBlockedReason) && next?.kind !== "view-purchase";

  return (
    <RecordRow
      aria-label={`${card.title}, ${card.statusLabel}`}
      {...(href ? { href, linkAs: Link } : {})}
      leading={
        <RecordRowMedia>
          <MediaImage src={card.image} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={card.title}
      meta={[
        card.lotLabel,
        card.saleTitle,
        card.placedBy ? `Placed by ${card.placedBy}` : null,
        card.placementNote,
      ]}
      metaShrink={1}
      // The visitor's time sits under the close in a wide row, and after the facts in a narrow one.
      metaNarrow={ownTime}
      figures={card.figures.map((figure, index, all) => ({
        ...figure,
        // The last figure is the one that carries a time; it is roomy on every row so they align.
        ...(index === all.length - 1 ? { roomyWhenAway: true } : {}),
        ...(ownTime && figure.label === CLOSES_FIGURE_LABEL ? { note: ownTime } : {}),
      }))}
      aligned
      status={
        <StatusBadge tone={badge.tone} shape={badge.shape}>
          {card.statusLabel}
        </StatusBadge>
      }
      action={
        next ? (
          <RowStep
            label={next.label}
            accessibleName={`${next.label}, ${card.title}`}
            href={next.href}
            blockedReason={blocked ? bidBlockedReason : null}
          />
        ) : null
      }
      needsYou={bidNeedsYou(card.status)}
      menu={
        menu.length > 0 ? <InlineActionMenu label={`More for ${card.title}`} items={menu} /> : null
      }
    />
  );
}
