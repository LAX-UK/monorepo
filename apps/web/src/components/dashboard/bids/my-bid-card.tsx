import { MediaImage } from "@/components/ui/media-image";
import type { MyBidStatus } from "@/lib/bid/my-bid-status";
import type { MyBidCardVm, MyBidFigure } from "@/lib/bid/my-bids.vm";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui/components/dot-status-pill";
import { History } from "lucide-react";
import Link from "next/link";
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
  outbid: "border-danger/50 shadow-[inset_3px_0_0_var(--color-danger)]",
};

function FigureValue({ figure }: { figure: MyBidFigure }) {
  if (figure.kind === "countdown") return <BidCloseCountdown endsAt={figure.endsAt} />;
  return <span className="tabular-nums">{figure.value}</span>;
}

function Figures({ figures }: { figures: MyBidFigure[] }) {
  if (figures.length === 0) return null;
  return (
    <dl className="grid grid-flow-col grid-cols-[repeat(3,minmax(0,1fr))] grid-rows-[auto_auto] gap-x-4 gap-y-1 max-xl:border-t max-xl:border-outline-variant/50 max-xl:pt-3 xl:w-[27rem] xl:shrink-0">
      {/* Labels share the first row and values the second, so values line up when a label wraps. */}
      {figures.map((figure) => [
        <dt
          key={`${figure.label}-label`}
          className="self-end font-body text-xs text-on-surface-variant"
        >
          {figure.label}
        </dt>,
        <dd
          key={`${figure.label}-value`}
          className="min-w-0 font-body text-sm font-medium tabular-nums text-on-surface sm:text-base"
        >
          <FigureValue figure={figure} />
        </dd>,
      ])}
    </dl>
  );
}

function Actions({
  card,
  onOpenHistory,
}: {
  card: MyBidCardVm;
  onOpenHistory: (() => void) | null;
}) {
  if (card.actions.length === 0 && !onOpenHistory) return null;
  return (
    <div
      className={cn(
        "flex justify-end gap-2",
        // Two steps share the full width on phones, side by side.
        card.actions.length > 1 && "max-sm:w-full max-sm:[&>a]:flex-1",
      )}
    >
      {onOpenHistory ? (
        <Button
          type="button"
          variant="ghost"
          size="default"
          onClick={onOpenHistory}
          aria-label={`Bid history for ${card.title}`}
          className="shrink-0 px-3"
        >
          <History aria-hidden />
          <span className="max-sm:sr-only">History</span>
        </Button>
      ) : null}
      {card.actions.map((action) => (
        <Button
          key={action.kind}
          asChild
          size="default"
          variant={action.emphasis === "primary" ? "primary" : "secondaryOutline"}
        >
          <Link href={action.href} aria-label={`${action.label}, ${card.title}`}>
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

/**
 * One lot the person has bid on: the work, three figures that say where the bid stands, its
 * status and the one next step. Stacks on phones with the status beside the step.
 */
export function MyBidCard({
  card,
  onOpenHistory = null,
}: {
  card: MyBidCardVm;
  /** Opens the lot's full bid history; `null` for a lot that has left the catalogue. */
  onOpenHistory?: (() => void) | null;
}) {
  const status = <DotStatusPill label={card.statusLabel} tone={STATUS_TONE[card.status]} />;
  return (
    <article
      aria-label={`${card.title}, ${card.statusLabel}`}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 xl:flex-row xl:items-center xl:gap-6",
        STATUS_EDGE[card.status],
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4 xl:items-center">
        <div className="relative size-18 shrink-0 overflow-hidden rounded-md bg-surface-container-high md:size-24">
          {card.href ? (
            <Link href={card.href} tabIndex={-1} aria-hidden className="absolute inset-0">
              <MediaImage src={card.image} alt="" label="Lot image" sizes="96px" />
            </Link>
          ) : (
            <MediaImage src={card.image} alt="" label="Lot image" sizes="96px" />
          )}
        </div>
        <div className="min-w-0">
          {card.lotLabel || card.saleTitle ? (
            <p className="truncate font-body text-xs text-on-surface-variant">
              {card.lotLabel ? (
                <span className="font-semibold text-on-surface">{card.lotLabel}</span>
              ) : null}
              {card.lotLabel && card.saleTitle ? <span aria-hidden> · </span> : null}
              {card.saleTitle}
            </p>
          ) : null}
          <h2 className="mt-1 font-headline text-base font-semibold leading-snug text-on-surface md:text-lg">
            {card.href ? (
              <Link
                href={card.href}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {card.title}
              </Link>
            ) : (
              card.title
            )}
          </h2>
          {card.details ? (
            <p className="mt-1 font-body text-sm text-on-surface-variant">{card.details}</p>
          ) : null}
          {card.placementNote ? (
            <p className="mt-1 font-body text-xs text-on-surface-variant">{card.placementNote}</p>
          ) : null}
        </div>
      </div>
      <Figures figures={card.figures} />
      <div className="flex flex-wrap items-center justify-between gap-3 xl:w-[21rem] xl:flex-nowrap xl:shrink-0 xl:flex-col xl:items-end xl:justify-center">
        {status}
        <Actions card={card} onOpenHistory={onOpenHistory} />
      </div>
    </article>
  );
}
