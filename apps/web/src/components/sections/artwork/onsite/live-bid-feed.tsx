"use client";

import {
  type BidFeedEntryVM,
  mapBidHistoryToFeedEntries,
} from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { BidFeedEntry } from "@/components/sections/artwork/onsite/bid-feed-entry";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { cn } from "@auction/ui";
import { Eye, Gavel } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

function formatWatchingLabel(count: number): string {
  if (count >= 1000) {
    return `${Math.floor(count / 1000)}k watching`;
  }
  return `${count} watching`;
}

type Props = {
  lotId: string;
  initialHistory: BidHistoryEntry[];
  currentUserId: string | null;
  className?: string;
  headerMode?: "bids" | "watching" | "none";
  watcherCount?: number | null;
  listMaxHeightClass?: string;
};

export function LiveBidFeed({
  lotId,
  initialHistory,
  currentUserId,
  className,
  headerMode = "bids",
  watcherCount = null,
  listMaxHeightClass = "max-h-[min(55vh,520px)]",
}: Props) {
  const [entries, setEntries] = useState<BidHistoryEntry[]>(initialHistory);

  const onBidUpdate = useCallback((e: { bidId: string; bidderId: string; amount: string }) => {
    setEntries((prev) => {
      const next: BidHistoryEntry = {
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
        at: Date.now(),
      };
      return [next, ...prev].filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);
    });
  }, []);

  useLotRealtime(lotId, {
    onBidUpdate: (e) => {
      onBidUpdate({
        bidId: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
    },
  });

  const rows: BidFeedEntryVM[] = useMemo(
    () => mapBidHistoryToFeedEntries(entries, currentUserId),
    [entries, currentUserId],
  );

  const bidCountLabel =
    rows.length >= 1000 ? `${Math.floor(rows.length / 1000)}k bids` : `${rows.length} bids`;

  const highest = rows.length > 0 ? rows[0] : null;
  const rest = rows.length > 1 ? rows.slice(1) : [];

  const showHeader = headerMode !== "none";

  return (
    <div className={cn("flex w-full flex-col overflow-hidden lg:max-w-[440px]", className)}>
      <div className="h-4 shrink-0 rounded-t-lg bg-gradient-to-r from-surface-container-high to-surface-container-low dark:from-surface-container-high dark:to-surface-container-low" />
      <div className="flex flex-col gap-4 rounded-b-lg border-b border-l border-r border-[#F1F1F3] bg-surface-container-lowest p-4 dark:border-outline-variant/30 dark:bg-surface-container-low/40">
        {showHeader ? (
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            <h2 className="flex-1 font-body text-xl font-medium text-[#050505] dark:text-on-surface">
              Live Feed
            </h2>
            {headerMode === "watching" ? (
              watcherCount != null ? (
                <div className="flex items-center gap-2 rounded-full px-2 py-0.5">
                  <Eye className="size-4 text-[#191919] dark:text-on-surface-variant" aria-hidden />
                  <span className="font-body text-xs font-medium text-[#191919] dark:text-on-surface-variant">
                    {formatWatchingLabel(watcherCount)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 font-body text-xs font-medium text-[#191919] dark:text-on-surface-variant">
                  <span
                    className="size-2 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  />
                  <span>Live now</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 rounded-full px-2 py-0.5">
                <Gavel className="size-4 text-[#191919] dark:text-on-surface-variant" aria-hidden />
                <span className="font-body text-xs font-medium text-[#191919] dark:text-on-surface-variant">
                  {bidCountLabel}
                </span>
              </div>
            )}
          </div>
        ) : null}
        <div
          className={cn(
            "flex flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]",
            listMaxHeightClass,
          )}
          aria-live="polite"
          aria-relevant="additions"
        >
          {rows.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">No bids yet.</p>
          ) : (
            <>
              {highest ? (
                <div
                  key={highest.id}
                  className="motion-safe:animate-artwork-slide-up-fade motion-reduce:opacity-100"
                >
                  <BidFeedEntry entry={highest} />
                </div>
              ) : null}
              {rest.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {rest.map((entry, i) => (
                    <li
                      key={entry.id}
                      className={cn(
                        "motion-safe:animate-artwork-slide-up-fade motion-reduce:opacity-100",
                      )}
                      style={
                        i > 0
                          ? ({
                              animationDelay: `${Math.min(i, 10) * 40}ms`,
                            } satisfies CSSProperties)
                          : undefined
                      }
                    >
                      <BidFeedEntry entry={entry} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
