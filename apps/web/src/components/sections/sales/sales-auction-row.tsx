import { SaleCalendarCountdown } from "@/components/sections/sales/sale-calendar-countdown";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { Button, LiveDot, cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  vm: SaleAuctionRowVM;
  index?: number;
};

export function SalesAuctionRow({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);
  const delay = index * 50;

  return (
    <li
      className={cn(
        "sales-calendar-row-animate border-b border-[#D1D1D1] bg-white dark:border-outline-variant/30 dark:bg-surface-container-low/30",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col gap-6 py-8 lg:flex-row lg:items-stretch lg:gap-6 lg:py-8">
        <div
          className={cn(
            "group/image relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[#E4E4E7] dark:bg-surface-container-low",
            "lg:h-[300px] lg:w-[min(100%,435px)] lg:max-w-[435px] lg:aspect-auto",
          )}
        >
          <Link href={vm.href} className="absolute inset-0 block" aria-label={vm.title}>
            <MediaImage
              src={vm.coverImageUrl}
              alt={vm.coverImageAlt}
              label="Auction cover"
              className="absolute inset-0 size-full"
              imgClassName={cn(
                "size-full object-cover transition-transform duration-700 ease-out",
                "motion-safe:group-hover/image:scale-[1.03] motion-reduce:group-hover/image:scale-100",
              )}
              sizes="(max-width: 1024px) 100vw, 435px"
            />
          </Link>
          <div className="pointer-events-none absolute inset-0 bg-black/10" aria-hidden />
          {isLive && vm.countdownEndIso ? (
            <div
              className="absolute bottom-3 left-3 flex h-8 items-center gap-1 rounded-[4px] bg-[rgba(5,5,5,0.4)] px-2"
              aria-label="Live auction, time remaining"
            >
              <LiveDot size="sm" className="shrink-0" />
              <span className="font-body text-[13px] font-semibold leading-4 text-[#F1F1F3]">
                Live
              </span>
              <SaleCalendarCountdown endIso={vm.countdownEndIso} />
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-8 lg:min-h-[300px]">
          <div className="flex flex-col gap-8 lg:gap-10">
            <p className="font-body text-base font-medium uppercase leading-4 text-[#191919] dark:text-on-surface/90">
              <span className="font-semibold">{vm.scheduleLead}</span>
              <span className="font-normal">{vm.scheduleRest}</span>
            </p>
            <div className="flex flex-col gap-4">
              <span className="font-body text-base font-normal uppercase leading-4 text-[#191919] dark:text-on-surface/90">
                {vm.auctionTypeLine}
              </span>
              <Link
                href={vm.href}
                className="font-body text-lg font-semibold leading-6 text-[#050505] underline-offset-2 transition-colors hover:underline dark:text-on-surface"
              >
                {vm.title}
              </Link>
              <span className="font-body text-base font-normal uppercase leading-4 text-[#191919] dark:text-on-surface/90">
                {vm.itemsLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2.5">
            {vm.showRegisterButton ? (
              <Button
                variant="outline"
                asChild
                className="h-9 rounded border-[#0A0A0A] px-4 text-[13px] font-semibold tracking-wide text-[#0A0A0A] transition-transform duration-150 ease-out motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] dark:border-on-surface dark:text-on-surface sm:h-8"
              >
                <Link href="/register">Register to bid</Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              asChild
              className="h-9 rounded border-[#0A0A0A] px-4 text-[13px] font-semibold tracking-wide text-[#0A0A0A] transition-transform duration-150 ease-out motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] dark:border-on-surface dark:text-on-surface sm:h-8"
            >
              <Link href={vm.lotsHref}>View Lots</Link>
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
