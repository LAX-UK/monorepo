"use client";

import { MediaImage } from "@/components/ui/media-image";
import { BID_STATUS_BADGE } from "@/lib/bid/bid-status-badge";
import type { MyBidCardVm } from "@/lib/bid/my-bids.vm";
import { notify } from "@/lib/ui/notify";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { Button, ButtonLink, StatusBadge } from "@auction/ui/lax";
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
      figures={card.figures}
      aligned
      status={
        <StatusBadge tone={badge.tone} shape={badge.shape}>
          {card.statusLabel}
        </StatusBadge>
      }
      action={
        next ? (
          blocked ? (
            <Button size="sm" {...(bidBlockedReason ? { disabledReason: bidBlockedReason } : {})}>
              {next.label}
            </Button>
          ) : (
            <ButtonLink
              href={next.href}
              Link={Link}
              size="sm"
              // Row steps are secondary: a list never holds the page's one primary action.
              variant="secondary"
              aria-label={`${next.label}, ${card.title}`}
            >
              {next.label}
            </ButtonLink>
          )
        ) : null
      }
      menu={
        menu.length > 0 ? <InlineActionMenu label={`More for ${card.title}`} items={menu} /> : null
      }
    />
  );
}
