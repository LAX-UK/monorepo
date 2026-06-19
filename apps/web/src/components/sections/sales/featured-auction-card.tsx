import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { SaleCardGrid } from "@/components/marketing/sale-card";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vm: FeaturedAuctionCardVM;
  index?: number;
};

export function FeaturedAuctionCard({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);

  return (
    <li className="h-full min-w-0 flex-1">
      <MarketingCardReveal index={index} className="block h-full min-w-0">
        <SaleCardGrid href={vm.href} className="motion-safe:ease-out">
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
            <div className="flex flex-wrap items-center gap-2">
              <SaleLifecycleBadge status={vm.status} size="sm" />
              <SaleTypeBadge deliveryMode={vm.deliveryMode} size="sm" isLive={isLive} />
              <div className="flex min-h-[1em] items-center self-stretch border-l border-on-surface-variant pl-2">
                <span className="font-body text-xs font-normal uppercase leading-snug text-on-surface-variant sm:text-sm">
                  {vm.dateLabel}
                </span>
              </div>
            </div>

            <SaleCardTitle mode="embedded" title={vm.title} className="line-clamp-2" />
            <SaleCardMeta locationLabel={vm.locationLabel} />
          </div>
        </SaleCardGrid>
      </MarketingCardReveal>
    </li>
  );
}
