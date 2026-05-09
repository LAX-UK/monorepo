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
          "flex min-h-16 items-center justify-between gap-3 rounded-b-[12px] bg-[#D5E5FF] py-1 pr-3 transition-colors duration-200 motion-reduce:transition-none dark:bg-primary/15",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full py-3 pl-4 pr-[26px]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#252527] dark:bg-on-surface">
              <span className="font-body text-sm font-bold leading-none text-[#F1F1F3] dark:text-on-primary">
                {entry.rank}
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-body text-xs font-medium leading-3 text-[#191919] dark:text-on-surface-variant">
              {entry.paddleNumber}
              {entry.isYourBid ? <span className="ml-2 text-primary">You</span> : null}
            </p>
            <p className="font-body text-xs font-semibold uppercase leading-6 tabular-nums text-[#050505] dark:text-on-surface">
              {entry.amount}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-white/80 px-2 py-1 font-body text-xs font-bold uppercase leading-4 text-[#1A4C99] dark:bg-surface-container-lowest/90 dark:text-primary">
          Highest
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-full border-b border-[#D1D1D1]/80 bg-[rgba(241,241,243,0.6)] py-3 pl-4 pr-[26px] transition-colors duration-200 motion-reduce:transition-none dark:border-outline-variant/20 dark:bg-surface-container-high/40",
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1F1F3] dark:bg-surface-container-high">
        <Calendar className="size-5 text-[#050505] dark:text-on-surface" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs font-medium leading-3 text-[#A3A3A3] dark:text-on-surface-variant">
          {entry.paddleNumber}
          {entry.isYourBid ? <span className="ml-2 text-primary">You</span> : null}
        </p>
        <p className="font-body text-xs font-semibold uppercase leading-6 tabular-nums text-[#050505] dark:text-on-surface">
          {entry.amount}
        </p>
      </div>
    </div>
  );
}
