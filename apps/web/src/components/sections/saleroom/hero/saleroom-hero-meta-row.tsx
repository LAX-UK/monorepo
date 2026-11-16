import { SaleFormatLine } from "@/components/marketing/sale-format-line";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import {
  SALEROOM_HERO_LIVE_BADGE_LABEL,
  isSaleroomHeroLiveNow,
} from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleDeliveryMode } from "@auction/types";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { OfficialTime } from "@auction/ui/time";

type Props = {
  hero: SaleHeroVM;
  liveTrailing: string;
  /** The saleroom session, from the same source as the "Saleroom live" strip. */
  liveSession?: PublicSaleroomSessionStatus | null;
  deliveryMode: SaleDeliveryMode;
  showOnlineBiddingGatedBadge?: boolean;
  explainerContext?: SaleFormatExplainerContext | undefined;
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
  liveSession,
  deliveryMode,
  showOnlineBiddingGatedBadge = false,
  explainerContext,
}: Props) {
  const showStatus = LIFECYCLE_STATUSES.includes(hero.status);
  const liveNow = isSaleroomHeroLiveNow(hero.status, liveSession);

  return (
    // Raised above the title and image that follow, so the open time panel is not covered.
    <div className="fade-up relative z-10 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showStatus ? (
          <SaleLifecycleBadge
            status={liveNow ? "active" : hero.status}
            opensAt={hero.startTime}
            label={liveNow ? SALEROOM_HERO_LIVE_BADGE_LABEL : undefined}
          />
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
        explainerContext={explainerContext}
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
