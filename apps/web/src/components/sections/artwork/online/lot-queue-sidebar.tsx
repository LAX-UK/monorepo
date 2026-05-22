"use client";

import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";
import { LotQueueCard } from "@/components/sections/artwork/online/lot-queue-card";
import { cn } from "@auction/ui";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

export { shouldShowLotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar-utils";

type Props = {
  current: LotQueueCardVM;
  upNext: LotQueueCardVM | null;
  queue: LotQueueCardVM[];
  /** True while sale siblings are still resolving (optional shimmer). */
  isSaleQueueLoading?: boolean;
  className?: string;
};

function queueLotCount(upNext: LotQueueCardVM | null, queue: LotQueueCardVM[]): number {
  return (upNext ? 1 : 0) + queue.length;
}

/** Sale queue: collapsed trigger on mobile; full sidebar on desktop. */
export function LotQueueSidebar({
  current: _current,
  upNext,
  queue,
  isSaleQueueLoading = false,
  className,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();
  const count = queueLotCount(upNext, queue);
  const allCards = [...(upNext ? [upNext] : []), ...queue];

  if (count === 0 && !isSaleQueueLoading) {
    return null;
  }

  const upNextTitle = upNext?.title ?? "—";

  return (
    <aside
      className={cn(
        "w-full shrink-0 lg:max-w-[320px] lg:border-r lg:border-[#D1D1D1] lg:pr-6 dark:lg:border-outline-variant/30",
        className,
      )}
    >
      {/* Mobile: collapsed trigger + horizontal carousel */}
      <div className="lg:hidden">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-3 py-3 text-left dark:bg-surface-container-low/30"
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-on-surface-variant transition-transform",
              mobileOpen && "rotate-180",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 font-body text-sm text-on-surface">
            <span className="font-medium">
              {isSaleQueueLoading
                ? "Loading sale…"
                : `${count} lot${count === 1 ? "" : "s"} in this sale`}
            </span>
            {upNext && !isSaleQueueLoading ? (
              <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                Up next: {upNextTitle}
              </span>
            ) : null}
          </span>
        </button>
        {mobileOpen && !isSaleQueueLoading && allCards.length > 0 ? (
          <div id={panelId} className="mt-3">
            <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {allCards.map((vm, i) => (
                <li key={vm.id} className="w-[min(100%,280px)] shrink-0 snap-start">
                  <LotQueueCard
                    vm={vm}
                    variant={i === 0 && upNext ? "upNext" : "queued"}
                    index={i}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {isSaleQueueLoading ? (
          <div
            className="mt-3 h-3 w-32 animate-pulse rounded bg-surface-container-high"
            aria-busy="true"
            aria-label="Loading queue"
          />
        ) : null}
      </div>

      {/* Desktop: vertical sidebar */}
      <div className="hidden flex-col gap-6 lg:flex">
        {upNext ? (
          <div className="flex w-full flex-col gap-3">
            <p className="font-body text-xs font-semibold uppercase leading-4 text-[#474747] dark:text-on-surface-variant">
              Up next
            </p>
            <LotQueueCard vm={upNext} variant="upNext" index={0} />
          </div>
        ) : null}

        {isSaleQueueLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading queue">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-container-high" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-surface-container-high" />
          </div>
        ) : queue.length > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <p className="font-body text-xs font-semibold uppercase leading-4 text-[#474747] dark:text-on-surface-variant">
              Queue ({queue.length})
            </p>
            <ul className="flex max-h-[min(40vh,420px)] flex-col gap-3 overflow-y-auto [scrollbar-width:thin]">
              {queue.map((vm, i) => (
                <li key={vm.id}>
                  <LotQueueCard vm={vm} variant="queued" index={i + 1} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
