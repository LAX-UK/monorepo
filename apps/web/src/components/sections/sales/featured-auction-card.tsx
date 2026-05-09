import { SaleCalendarCountdown } from "@/components/sections/sales/sale-calendar-countdown";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { LiveDot, cn } from "@auction/ui";
import { MapPin } from "lucide-react";
import Link from "next/link";

type Props = {
  vm: FeaturedAuctionCardVM;
  index?: number;
};

export function FeaturedAuctionCard({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);
  const delayMs = index * 100;

  return (
    <li className="h-full min-w-0 flex-1">
      <Link
        href={vm.href}
        className={cn(
          "group/card flex h-full min-h-0 flex-col gap-[10px] rounded-lg bg-[#F1F1F3] p-3 pb-6 dark:bg-surface-container-high",
          "outline outline-1 -outline-offset-1 outline-[rgba(209,209,209,0.65)] dark:outline-outline-variant/50",
          "motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#F1F1F3] dark:focus-visible:ring-offset-surface-container-high",
        )}
        style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      >
        <div
          className={cn(
            "group/image relative h-[180px] w-full overflow-hidden rounded sm:h-[200px] lg:h-[240px]",
            "bg-[#E4E4E7] dark:bg-surface-container-low",
          )}
        >
          <MediaImage
            src={vm.coverImageUrl}
            alt={vm.coverImageAlt}
            label="Auction cover"
            className="absolute inset-0 size-full"
            imgClassName={cn(
              "size-full object-cover transition-transform duration-700 ease-out",
              "motion-safe:group-hover/image:scale-105 motion-reduce:group-hover/image:scale-100",
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="pointer-events-none absolute inset-0 rounded bg-black/20" aria-hidden />

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

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="font-body text-base font-normal leading-[21.6px] text-[#050505] dark:text-on-surface">
              {vm.auctionTypeLabel}
            </span>
            <div className="flex min-h-[1em] items-center self-stretch border-l border-[#191919] pl-2 dark:border-on-surface/80">
              <span className="font-body text-sm font-normal uppercase leading-4 text-[#191919] dark:text-on-surface/90">
                {vm.dateLabel}
              </span>
            </div>
          </div>

          <p className="font-body text-sm font-normal leading-snug text-[#474747] dark:text-on-surface/70">
            {vm.title}
          </p>

          {vm.locationLabel ? (
            <p className="flex items-center gap-1 font-body text-sm font-normal leading-4 text-[#191919] dark:text-on-surface/90">
              <MapPin
                className="size-4 shrink-0 text-[#191919] opacity-90 dark:text-on-surface/80"
                aria-hidden
              />
              <span>{vm.locationLabel}</span>
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
