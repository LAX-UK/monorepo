"use client";

import {
  type BidFeedEntryVM,
  mapBidHistoryToFeedEntries,
} from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { BidFeedEntry } from "@/components/sections/artwork/onsite/bid-feed-entry";
import {
  type LiveFeedHeaderMeta,
  getLiveFeedHeaderMeta,
} from "@/components/sections/artwork/onsite/live-feed-header";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import { cn } from "@auction/ui";
import { Gavel } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo } from "react";

function statusDotClass(tone: "live" | "upcoming" | "ended"): string {
  switch (tone) {
    case "live":
      return "bg-red-500";
    case "upcoming":
      return "bg-lot-orange";
    case "ended":
      return "bg-on-surface-variant/60";
  }
}

type Props = {
  /** Bid history owned by parent (e.g. `OnlineBidsView` + single realtime subscription). */
  entries: BidHistoryEntry[];
  currentUserId: string | null;
  className?: string;
  headerMode?: "bids" | "watching" | "none";
  watcherCount?: number | null;
  /** Unified lifecycle — drives header label when `headerMode` is `watching`. */
  lifecycleKind?: LotLifecycleKind;
  countdownClock?: string;
  /** When true, header shows bid count only (countdown lives elsewhere). */
  compactHeader?: boolean;
  listMaxHeightClass?: string;
};

export function LiveBidFeed({
  entries,
  currentUserId,
  className,
  headerMode = "bids",
  watcherCount = null,
  lifecycleKind = "preLaunch",
  countdownClock = "",
  compactHeader = false,
  listMaxHeightClass = "max-h-[min(55vh,520px)]",
}: Props) {
  const rows: BidFeedEntryVM[] = useMemo(
    () => mapBidHistoryToFeedEntries(entries, currentUserId),
    [entries, currentUserId],
  );

  const bidCountLabel =
    rows.length >= 1000 ? `${Math.floor(rows.length / 1000)}k bids` : `${rows.length} bids`;

  const highest = rows.length > 0 ? rows[0] : null;
  const rest = rows.length > 1 ? rows.slice(1) : [];

  const showHeader = headerMode !== "none";

  const watchingHeader = useMemo(() => {
    if (compactHeader) {
      const tone: LiveFeedHeaderMeta["tone"] =
        lifecycleKind === "live" ||
        lifecycleKind === "extended" ||
        lifecycleKind === "liveSaleroom" ||
        lifecycleKind === "saleroomPaused"
          ? "live"
          : lifecycleKind === "scheduled" || lifecycleKind === "preLaunch"
            ? "upcoming"
            : "ended";
      const watchingLabel =
        watcherCount != null && watcherCount > 0
          ? watcherCount >= 1000
            ? `${Math.floor(watcherCount / 1000)}k watching`
            : `${watcherCount} watching`
          : null;
      return {
        title: "Live Feed",
        statusLabel: watchingLabel ? `${bidCountLabel} · ${watchingLabel}` : bidCountLabel,
        pulse: tone === "live",
        tone,
      };
    }
    return getLiveFeedHeaderMeta(lifecycleKind, {
      countdownClock,
      watcherCount,
    });
  }, [compactHeader, lifecycleKind, countdownClock, watcherCount, bidCountLabel]);

  return (
    <div className={cn("flex w-full flex-col overflow-hidden lg:max-w-[440px]", className)}>
      <div className="h-4 shrink-0 rounded-t-lg bg-gradient-to-r from-surface-container-high to-surface-container-low dark:from-surface-container-high dark:to-surface-container-low" />
      <div className="flex flex-col gap-4 rounded-b-lg border-b border-l border-r border-outline-variant/30 bg-surface-container-lowest p-4 dark:bg-surface-container-low/40">
        {showHeader ? (
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            <h2 className="flex-1 font-body text-xl font-medium text-on-surface">
              {headerMode === "watching" ? watchingHeader.title : "Live Feed"}
            </h2>
            {headerMode === "watching" ? (
              <div className="flex items-center gap-2 font-body text-xs font-medium text-on-surface-variant">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    statusDotClass(watchingHeader.tone),
                    watchingHeader.pulse && "motion-safe:animate-pulse motion-reduce:animate-none",
                  )}
                  aria-hidden
                />
                <span>{watchingHeader.statusLabel}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full px-2 py-0.5">
                <Gavel className="size-4 text-on-surface-variant" aria-hidden />
                <span className="font-body text-xs font-medium text-on-surface-variant">
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
