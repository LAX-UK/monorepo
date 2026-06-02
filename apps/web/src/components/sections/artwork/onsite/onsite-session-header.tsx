import type { AuctionSessionHeaderVM } from "@/components/sections/artwork/artwork-view-models";
import { OnsiteSaleScheduleCountdown } from "@/components/sections/artwork/onsite/onsite-sale-schedule-countdown";
import { salePath } from "@/lib/seo/url";
import type { Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  vm: AuctionSessionHeaderVM;
  sale: Sale;
  className?: string;
};

/** Sticky onsite session bar: sale title, lot label, compact countdown, catalogue link. */
export function OnsiteSessionHeader({ vm, sale, className }: Props) {
  return (
    <header
      className={cn(
        "sticky top-[var(--header-height)] z-20 border-b border-outline-variant/30 bg-page-bg/95 pb-4 pt-3 backdrop-blur-md dark:bg-background/95",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-end sm:gap-2">
          <p className="truncate font-body text-lg font-medium text-on-surface sm:text-xl">
            {vm.saleTitle}
          </p>
          <p className="truncate font-body text-sm font-medium text-on-surface-variant sm:text-base">
            {vm.lotLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[10rem] flex-1 sm:flex-none">
            <OnsiteSaleScheduleCountdown sale={sale} variant="compact" />
          </div>
          <Button variant="outline" size="sm" className="hidden lg:inline-flex" asChild>
            <Link href={salePath(sale)}>View catalogue</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
