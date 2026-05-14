import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";
import { LotQueueCard } from "@/components/sections/artwork/online/lot-queue-card";
import { LotStatePill } from "@/components/sections/artwork/online/lot-state-pill";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";

type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  current: LotQueueCardVM;
  upNext: LotQueueCardVM | null;
  queue: LotQueueCardVM[];
  /** Full lot for lifecycle pill (mirrors sticky header). */
  lifecycleLot: Pick<
    Lot,
    "id" | "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice"
  >;
  saleForLifecycle: SalePick;
  /** True while sale siblings are still resolving (optional shimmer). */
  isSaleQueueLoading?: boolean;
  /** Align queue pill with server clock (same as sticky header). */
  statePillInitialNowMs?: number;
  className?: string;
};

/** Current lot summary, up next, and queue — mobile-first stack; queue scrolls horizontally on small screens. */
export function LotQueueSidebar({
  current,
  upNext,
  queue,
  lifecycleLot,
  saleForLifecycle,
  isSaleQueueLoading = false,
  statePillInitialNowMs,
  className,
}: Props) {
  const queueCount = queue.length;

  return (
    <aside
      className={cn(
        "w-full shrink-0 border-[#D1D1D1] dark:border-outline-variant/30 lg:max-w-[320px] lg:border-r lg:pr-6",
        className,
      )}
    >
      <div className="flex flex-col gap-6">
        <div className="border-b border-[#D1D1D1]/50 pb-4 dark:border-outline-variant/30">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <LotStatePill
                lot={lifecycleLot}
                sale={saleForLifecycle}
                compact
                {...(statePillInitialNowMs !== undefined
                  ? { initialNowMs: statePillInitialNowMs }
                  : {})}
              />
              <p className="font-body text-xs text-on-surface-variant">
                Follow this lot (below) to save it — we&apos;ll email you before it opens.
              </p>
              <div className="flex flex-col gap-2">
                <h2 className="font-body text-xl font-medium leading-tight text-[#050505] motion-safe:transition-opacity dark:text-on-surface sm:text-2xl">
                  {current.lotNumber != null ? `${current.lotNumber}. ` : ""}
                  {current.title}
                </h2>
                <p className="font-body text-sm font-light text-[#191919] dark:text-on-surface-variant sm:text-base">
                  {current.artistName}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-2 text-center">
                <span className="self-stretch font-body text-xs font-medium text-[#474747] dark:text-on-surface-variant">
                  Estimate
                </span>
                <span className="font-body text-sm font-medium text-[#474747] dark:text-on-surface-variant">
                  {current.estimateLine ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-2 text-center">
                <span className="self-stretch font-body text-xs font-medium text-[#474747] dark:text-on-surface-variant">
                  Current bid
                </span>
                <span className="font-body text-sm font-semibold text-[#050505] dark:text-on-surface">
                  {current.currentBid ?? current.estimateLine ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

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
            <p className="font-body text-xs text-on-surface-variant">
              Sale catalogue could not be loaded. Refresh the page or try again shortly.
            </p>
          </div>
        ) : queueCount > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <p className="font-body text-xs font-semibold uppercase leading-4 text-[#474747] dark:text-on-surface-variant">
              Queue ({queueCount})
            </p>
            <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:max-h-[min(40vh,420px)] lg:flex-col lg:overflow-y-auto lg:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:auto">
              {queue.map((vm, i) => (
                <li
                  key={vm.id}
                  className="w-[min(100%,280px)] shrink-0 snap-start lg:w-full lg:shrink"
                >
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
