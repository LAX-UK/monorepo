import type { AuctionSessionHeaderVM } from "@/components/sections/artwork/artwork-view-models";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  vm: AuctionSessionHeaderVM;
  /** e.g. live latency badge — aligned end, above paddle when both exist. */
  rightSlot?: ReactNode;
  /** Live lifecycle pill + countdown (client). */
  stateSlot?: ReactNode;
  className?: string;
};

/** Sticky session bar: sale + lot; paddle / verified when known. */
export function AuctionSessionHeader({ vm, rightSlot, stateSlot, className }: Props) {
  const showRightColumn = rightSlot != null || Boolean(vm.paddleNumber);

  return (
    <header
      className={cn(
        "sticky top-[var(--header-height)] z-20 border-b border-outline-variant/30 bg-page-bg/95 pb-4 pt-3 backdrop-blur-md transition-shadow duration-300 dark:bg-background/95",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-end sm:gap-2">
            <p className="truncate font-body text-lg font-medium text-on-surface sm:text-xl">
              {vm.saleTitle}
            </p>
            <p className="truncate font-body text-sm font-medium text-on-surface sm:max-w-[min(100%,280px)] sm:text-base">
              {vm.lotLabel}
            </p>
          </div>

          {showRightColumn ? (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {rightSlot}
              {vm.paddleNumber ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-body text-xs font-medium uppercase tracking-wide text-on-surface">
                    {vm.paddleNumber}
                  </span>
                  {vm.userVerified ? (
                    <span className="font-body text-[13px] font-medium text-success">
                      Verified user
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {stateSlot ? (
          <div className="border-t border-outline-variant/25 pt-3">{stateSlot}</div>
        ) : null}
      </div>
    </header>
  );
}
