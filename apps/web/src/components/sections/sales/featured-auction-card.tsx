import { SaleCardGrid } from "@/components/marketing/sale-card";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";
import { RevealInView } from "@/components/ui/reveal";
import { cn } from "@auction/ui";

type Props = {
  vm: FeaturedAuctionCardVM;
  index?: number;
};

export function FeaturedAuctionCard({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);

  return (
    <li className="h-full min-w-0 flex-1">
      <RevealInView variant="fadeUp" delayMs={index * 70} className="block h-full min-w-0">
        <SaleCardGrid
          href={vm.href}
          className={cn(
            "motion-safe:ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg",
          )}
        >
          <SaleCardMedia
            href={vm.href}
            coverImageUrl={vm.coverImageUrl}
            coverImageAlt={vm.coverImageAlt}
            isLive={isLive}
            linkMode="none"
            layout="featured"
            imageRoundedClassName="rounded"
            scrimClassName="rounded bg-black/20"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            {...(vm.countdownEndIso != null ? { countdownEndIso: vm.countdownEndIso } : {})}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-[10px]">
              <span className="font-body text-sm font-normal leading-snug text-on-surface sm:text-base sm:leading-[21.6px]">
                {vm.auctionTypeLabel}
              </span>
              <div className="flex min-h-[1em] items-center self-stretch border-l border-on-surface-variant pl-2">
                <span className="font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm">
                  {vm.dateLabel}
                </span>
              </div>
            </div>

            <SaleCardTitle mode="embedded" title={vm.title} />
            <SaleCardMeta locationLabel={vm.locationLabel} />
          </div>
        </SaleCardGrid>
      </RevealInView>
    </li>
  );
}
