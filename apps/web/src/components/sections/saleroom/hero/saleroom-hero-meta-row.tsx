import { SaleFormatLine } from "@/components/marketing/sale-format-line";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { SaleDeliveryMode } from "@auction/types";
import { StatusBadge } from "@auction/ui/lax";
import { OfficialTime } from "@auction/ui/time";

type Props = {
  hero: SaleHeroVM;
  liveTrailing: string;
  deliveryMode: SaleDeliveryMode;
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
  showOnlineBiddingGatedBadge = false,
  explainerContext,
}: Props) {
  const showStatus = LIFECYCLE_STATUSES.includes(hero.status);

  return (
    // Raised above the title and image that follow, so the open time panel is not covered.
    <div className="fade-up relative z-10 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showStatus ? <SaleLifecycleBadge status={hero.status} opensAt={hero.startTime} /> : null}
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-body text-sm text-on-surface-variant">
        {hero.startTime ? (
          <OfficialTime instant={hero.startTime} officialZone={hero.timeZone} placement="inline">
            {hero.dateLine}
          </OfficialTime>
        ) : (
          hero.dateLine
        )}
      </div>
    </div>
  );
}
