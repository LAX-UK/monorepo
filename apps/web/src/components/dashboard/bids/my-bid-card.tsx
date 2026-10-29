"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { MyBidStatus } from "@/lib/bid/my-bid-status";
import type { MyBidCardVm, MyBidFigure } from "@/lib/bid/my-bids.vm";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BidCloseCountdown } from "./bid-close-countdown";

const STATUS_TONE: Record<MyBidStatus, DotStatusPillTone> = {
  winning: "success",
  outbid: "critical",
  absentee: "pending",
  won: "sold",
  "not-won": "neutral",
  withdrawn: "neutral",
};

/** An outbid lot is the one that needs the person: its edge turns red. */
const STATUS_EDGE: Partial<Record<MyBidStatus, string>> = {
  outbid: "shadow-[inset_3px_0_0_var(--color-danger)]",
};

function FigureValue({ figure }: { figure: MyBidFigure }) {
  if (figure.kind === "countdown") return <BidCloseCountdown endsAt={figure.endsAt} />;
  return <span className="tabular-nums">{figure.value}</span>;
}

/** A figure in the facts line: "Your maximum £5,000", "Closes in 2h 14m". */
function FigureFact({ figure }: { figure: MyBidFigure }) {
  return (
    <>
      {figure.label} <FigureValue figure={figure} />
    </>
  );
}

/**
 * One lot the person has bid on, as a row: the work, where the bid stands (the lead figure on the
 * right, the others in the facts line), its status and the one next step. The bid history and any
 * other step sit in the "…" menu.
 */
export function MyBidCard({
  card,
  onOpenHistory = null,
}: {
  card: MyBidCardVm;
  /** Opens the lot's full bid history; `null` for a lot that has left the catalogue. */
  onOpenHistory?: (() => void) | null;
}) {
  const router = useRouter();
  const [lead, ...rest] = card.figures;
  const next = card.actions.at(-1);
  const others = card.actions.slice(0, -1);
  const menu: InlineActionMenuItem[] = [
    ...others.map((action) => ({
      type: "item" as const,
      label: action.label,
      onSelect: () => router.push(action.href),
    })),
    ...(onOpenHistory
      ? [{ type: "item" as const, label: "Bid history", onSelect: onOpenHistory }]
      : []),
  ];

  return (
    <RecordRow
      aria-label={`${card.title}, ${card.statusLabel}`}
      {...(STATUS_EDGE[card.status] ? { className: STATUS_EDGE[card.status] } : {})}
      {...(card.href ? { href: card.href, linkAs: Link } : {})}
      leading={
        <RecordRowMedia>
          <MediaImage src={card.image} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={card.title}
      meta={[
        card.lotLabel,
        card.saleTitle,
        ...rest.map((figure) => <FigureFact key={figure.label} figure={figure} />),
        card.placementNote,
      ]}
      status={<DotStatusPill label={card.statusLabel} tone={STATUS_TONE[card.status]} />}
      value={
        lead ? (
          <>
            <span className="font-normal text-on-surface-variant">{lead.label} </span>
            <FigureValue figure={lead} />
          </>
        ) : null
      }
      action={
        next ? (
          <Button
            asChild
            size="default"
            variant={next.emphasis === "primary" ? "primary" : "secondaryOutline"}
          >
            <Link href={next.href} aria-label={`${next.label}, ${card.title}`}>
              {next.label}
            </Link>
          </Button>
        ) : null
      }
      menu={
        menu.length > 0 ? <InlineActionMenu label={`More for ${card.title}`} items={menu} /> : null
      }
    />
  );
}
