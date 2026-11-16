import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import { toSaleCountdownEndIso } from "@auction/validators";

export type SaleroomHeroLotRef = {
  id: string;
  lotNumber: number | null;
  title: string;
};

export function resolveSaleroomHeroLiveTrailing(
  hero: Pick<SaleHeroVM, "isLive" | "liveLotsCount" | "itemsLabel">,
  opts: {
    liveSession: PublicSaleroomSessionStatus | null;
    catalogLotRefs: SaleroomHeroLotRef[];
  },
): string {
  const { liveSession, catalogLotRefs } = opts;
  // The lot on the block, while the floor is live (a paused floor names none).
  const onBlockId =
    liveSession && isSaleroomSessionLive(liveSession.status) ? liveSession.currentLotId : null;
  const onBlockLot = onBlockId == null ? undefined : catalogLotRefs.find((l) => l.id === onBlockId);
  if (onBlockLot) {
    const lotNum = onBlockLot.lotNumber != null ? `Lot ${onBlockLot.lotNumber}` : onBlockLot.title;
    return `· ${lotNum} on the block · ${catalogLotRefs.length} lots`;
  }

  if (hero.isLive && typeof hero.liveLotsCount === "number" && hero.liveLotsCount > 0) {
    return hero.liveLotsCount === 1 ? "· 1 lot" : `· ${hero.liveLotsCount} lots`;
  }

  return "";
}

export function resolveHeroCountdownEnd(
  hero: Pick<SaleHeroVM, "status" | "startTime" | "endTime" | "deliveryMode">,
  now = new Date(),
): string | null {
  if (hero.status === "active") {
    return (
      toSaleCountdownEndIso(
        {
          status: hero.status,
          endTime: hero.endTime,
          deliveryMode: hero.deliveryMode,
        },
        { now },
      ) ?? null
    );
  }
  if (hero.status === "scheduled") return hero.startTime;
  return null;
}

export function buildSaleroomHeroStats(
  hero: Pick<
    SaleHeroVM,
    "itemsLabel" | "lotCount" | "estimatedTotalLabel" | "registeredBidderCount"
  >,
): readonly (readonly [string, string])[] {
  // A sale announced before its lots are online has no count worth showing.
  const stats: (readonly [string, string])[] =
    hero.lotCount > 0 ? [["Total lots", hero.itemsLabel]] : [];
  if (hero.estimatedTotalLabel) {
    stats.push(["Est. total", hero.estimatedTotalLabel]);
  }
  if (typeof hero.registeredBidderCount === "number" && hero.registeredBidderCount > 0) {
    stats.push([
      "Registered",
      hero.registeredBidderCount === 1 ? "1 bidder" : `${hero.registeredBidderCount} bidders`,
    ]);
  }
  return stats;
}

export const SALEROOM_HERO_LIVE_BADGE_LABEL = "Live now";

/**
 * Whether the hero badge reads "Live now". A sale whose saleroom is running is live whatever its
 * scheduled start says, so the badge follows the same session status as the "Saleroom live" strip
 * rather than the clock ("Opens Mon 16 Nov" while the floor is already open). A paused floor
 * still reads "Live now": the sale is in session, and the live lot banner says it is paused.
 */
export function isSaleroomHeroLiveNow(
  status: SaleHeroVM["status"],
  liveSession: PublicSaleroomSessionStatus | null | undefined,
): boolean {
  return (
    status === "scheduled" && liveSession != null && isSaleroomSessionActive(liveSession.status)
  );
}
