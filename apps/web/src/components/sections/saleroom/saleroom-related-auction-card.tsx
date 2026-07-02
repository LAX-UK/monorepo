import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { SaleMetaBadges } from "@/components/marketing/sale-meta-badges";
import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardShell } from "@/components/sections/sales/card/sale-card-shell";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { RelatedSaleVM } from "./view-models";

type Props = {
  sale: RelatedSaleVM;
  index?: number;
};

export function SaleroomRelatedAuctionCard({ sale, index = 0 }: Props) {
  const mediaCommon = {
    href: sale.href,
    coverImageUrl: sale.imageUrl,
    coverImageAlt: sale.coverImageAlt,
    status: sale.status,
    deliveryMode: sale.deliveryMode,
    isLive: sale.isLive,
    linkMode: "area" as const,
    layout: "calendarRow" as const,
    sizes: "(max-width: 1024px) 100vw, 420px",
    ...(sale.countdownEndIso != null ? { countdownEndIso: sale.countdownEndIso } : {}),
  };

  return (
    <li className="list-none border-b border-outline-variant/20 py-6 last:border-b-0">
      <MarketingCardReveal index={index} className="block">
        <SaleCardShell className="p-3 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:gap-6">
            <SaleCardMedia {...mediaCommon} className="max-h-[11rem] sm:max-h-none" />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-6 lg:gap-8">
              <div className="flex flex-col gap-4">
                <SaleMetaBadges
                  status={sale.status}
                  deliveryMode={sale.deliveryMode}
                  dateLabel={sale.dateLabel}
                  isLive={sale.isLive}
                  startsSoon={sale.startsSoon}
                  locationLabel={sale.locationLabel}
                  withScheduleRow
                  showLifecycleBadge={false}
                  size="sm"
                />
                <SaleCardTitle href={sale.href} title={sale.title} />
                <SaleCardMeta itemsLabel={sale.itemsLabel} />
              </div>
              <SaleCardActions
                actions={[{ id: "explore", label: "Explore", href: sale.href, variant: "cta" }]}
              />
            </div>
          </div>
        </SaleCardShell>
      </MarketingCardReveal>
    </li>
  );
}
