import type { BidFeedEntryVM } from "@/components/sections/artwork/artwork-view-models";
import { cn } from "@auction/ui";
import { Calendar } from "lucide-react";

type Props = {
  entry: BidFeedEntryVM;
  className?: string;
};

export function BidFeedEntry({ entry, className }: Props) {
  if (entry.isHighest) {
    return (
      <div
        className={cn(
          "flex min-h-16 items-center justify-between gap-3 rounded-b-[12px] bg-primary/15 py-1 pr-3 transition-colors duration-200 motion-reduce:transition-none",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full py-3 pl-4 pr-[26px]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-on-surface">
              <span className="font-body text-sm font-bold leading-none text-on-primary">
                {entry.rank}
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-body text-xs font-medium leading-3 text-on-surface-variant">
              {entry.paddleNumber}
              {entry.channelLabel ? (
                <span className="ml-2 text-on-surface-variant/80">{entry.channelLabel}</span>
              ) : null}
              {entry.isYourBid ? <span className="ml-2 text-primary">You</span> : null}
            </p>
            <p className="font-body text-xs font-semibold uppercase leading-6 tabular-nums text-on-surface">
              {entry.amount}
              {entry.isAutoBid ? (
                <span className="ml-1.5 font-label text-[10px] font-bold normal-case tracking-wide text-primary">
                  Auto
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-surface-container-lowest/90 px-2 py-1 font-body text-xs font-bold uppercase leading-4 text-primary">
          {entry.isAutoBid && entry.isYourBid ? "Auto bid" : "Highest"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-full border-b border-outline-variant/30 bg-surface-container-high/50 py-3 pl-4 pr-[26px] transition-colors duration-200 motion-reduce:transition-none dark:bg-surface-container-high/40",
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
        <Calendar className="size-5 text-on-surface" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs font-medium leading-3 text-on-surface-variant">
          {entry.paddleNumber}
          {entry.channelLabel ? (
            <span className="ml-2 text-on-surface-variant/80">{entry.channelLabel}</span>
          ) : null}
          {entry.isYourBid ? <span className="ml-2 text-primary">You</span> : null}
        </p>
        <p className="font-body text-xs font-semibold uppercase leading-6 tabular-nums text-on-surface">
          {entry.amount}
          {entry.isAutoBid ? (
            <span className="ml-1.5 font-label text-[10px] font-bold normal-case tracking-wide text-primary">
              Auto
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
