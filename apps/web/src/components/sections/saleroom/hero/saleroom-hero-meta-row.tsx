import { SaleMetaBadges } from "@/components/marketing/sale-meta-badges";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { SaleDeliveryMode } from "@auction/types";

type Props = {
  hero: SaleHeroVM;
  liveTrailing: string;
  deliveryMode: SaleDeliveryMode;
  startsSoon?: boolean;
  showOnlineBiddingGatedBadge?: boolean;
  explainerContext?: SaleFormatExplainerContext;
};

export function SaleroomHeroMetaRow({
  hero,
  liveTrailing,
  deliveryMode,
  startsSoon = false,
  showOnlineBiddingGatedBadge = false,
  explainerContext,
}: Props) {
  const dateLabel = hero.startEndLabel;

  return (
    <div className="fade-up flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
      <p className="font-label text-[length:var(--text-label-2)] font-normal uppercase tracking-[0.16em] text-on-surface-variant sm:text-sm">
        {hero.dateLine}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SaleMetaBadges
          status={hero.status}
          deliveryMode={deliveryMode}
          dateLabel={dateLabel}
          isLive={hero.isLive}
          startsSoon={startsSoon}
          showLifecycleBadge
          showDate={false}
          withExplainer
          showOnlineBiddingGatedBadge={showOnlineBiddingGatedBadge}
          {...(explainerContext ? { explainerContext } : {})}
          size="sm"
        />
        {liveTrailing ? (
          <span className="font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
            {liveTrailing}
          </span>
        ) : null}
      </div>
    </div>
  );
}
