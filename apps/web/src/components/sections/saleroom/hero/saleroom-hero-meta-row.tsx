import { SaleFormatLine } from "@/components/marketing/sale-format-line";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { SaleDeliveryMode } from "@auction/types";
import { StatusBadge } from "@auction/ui/lax";

type Props = {
  hero: SaleHeroVM;
  liveTrailing: string;
  deliveryMode: SaleDeliveryMode;
  startsSoon?: boolean;
  showOnlineBiddingGatedBadge?: boolean;
  explainerContext?: SaleFormatExplainerContext;
};

const LIFECYCLE_STATUSES: ReadonlyArray<SaleHeroVM["status"]> = ["active", "scheduled", "ended"];

/**
 * What the sale is, in three plain lines: one status badge, the format with its place, and the
 * time. Nothing is said twice: an online sale has no place line, and the date is not repeated in
 * the countdown below.
 */
export function SaleroomHeroMetaRow({
  hero,
  liveTrailing,
  deliveryMode,
  startsSoon = false,
  showOnlineBiddingGatedBadge = false,
  explainerContext,
}: Props) {
  const showStatus = LIFECYCLE_STATUSES.includes(hero.status);
  const soon = startsSoon && !hero.isLive && hero.status === "scheduled";

  return (
    <div className="fade-up flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showStatus ? (
          <SaleLifecycleBadge status={hero.status} {...(soon ? { label: "Starts soon" } : {})} />
        ) : null}
        {showOnlineBiddingGatedBadge ? (
          <StatusBadge tone="neutral">Online bidding opens when live</StatusBadge>
        ) : null}
        {liveTrailing ? (
          <span className="font-label text-xs font-medium text-on-surface-variant">
            {liveTrailing}
          </span>
        ) : null}
      </div>
      <SaleFormatLine
        deliveryMode={deliveryMode}
        place={hero.placeLabel}
        withExplainer
        {...(explainerContext ? { explainerContext } : {})}
      />
      <p className="font-body text-sm text-on-surface-variant">{hero.dateLine}</p>
    </div>
  );
}
