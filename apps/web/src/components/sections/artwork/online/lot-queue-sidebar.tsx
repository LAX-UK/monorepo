import type { LotQueueCardVM } from "@/components/sections/artwork/artwork-view-models";
import { LotQueueCard } from "@/components/sections/artwork/online/lot-queue-card";
import { cn } from "@auction/ui";

type Props = {
  current: LotQueueCardVM;
  upNext: LotQueueCardVM | null;
  queue: LotQueueCardVM[];
  /** Live pulse for current lot strip */
  isLive?: boolean;
  className?: string;
};

function LiveDot() {
  return (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-live-red/70 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live-red" />
    </span>
  );
}

/** Current lot summary, up next, and queue — mobile-first stack; queue scrolls horizontally on small screens. */
export function LotQueueSidebar({ current, upNext, queue, isLive = false, className }: Props) {
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
            <div className="flex flex-col gap-1">
              {isLive ? (
                <div className="flex items-center gap-1">
                  <LiveDot />
                  <span className="font-body text-xs font-medium leading-6 text-[#050505] dark:text-on-surface">
                    Live now
                  </span>
                </div>
              ) : null}
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

        {queueCount > 0 ? (
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
