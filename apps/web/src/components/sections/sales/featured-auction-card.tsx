import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { SaleCardGrid } from "@/components/marketing/sale-card";
import { SaleMetaBadges } from "@/components/marketing/sale-meta-badges";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vm: FeaturedAuctionCardVM;
  index?: number;
};

export function FeaturedAuctionCard({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active";

  return (
    <li className="h-full min-w-0 flex-1">
      <MarketingCardReveal index={index} className="block h-full min-w-0">
        <SaleCardGrid href={vm.href} className="motion-safe:ease-out">
          <SaleCardMedia
            href={vm.href}
            coverImageUrl={vm.coverImageUrl}
            coverImageAlt={vm.coverImageAlt}
            status={vm.status}
            deliveryMode={vm.deliveryMode}
            isLive={isLive}
            linkMode="none"
            layout="featured"
            imageRoundedClassName="rounded"
            scrimClassName="rounded bg-black/20"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            {...(vm.endTimeIso != null ? { endTimeIso: vm.endTimeIso } : {})}
            {...(vm.countdownEndIso != null ? { countdownEndIso: vm.countdownEndIso } : {})}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <SaleMetaBadges
              status={vm.status}
              deliveryMode={vm.deliveryMode}
              dateLabel={vm.dateLabel}
              isLive={isLive}
              size="sm"
            />

            <SaleCardTitle mode="embedded" title={vm.title} className="line-clamp-2" />
            <SaleCardMeta itemsLabel={vm.itemsLabel} locationLabel={vm.locationLabel} />
          </div>
        </SaleCardGrid>
      </MarketingCardReveal>
    </li>
  );
}
