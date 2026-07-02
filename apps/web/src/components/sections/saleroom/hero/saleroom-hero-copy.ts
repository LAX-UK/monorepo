import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { isSaleroomSessionLive } from "@/lib/saleroom/public-session-status";
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
  const onBlockLot =
    opts.liveSession?.currentLotId != null
      ? opts.catalogLotRefs.find((l) => l.id === opts.liveSession?.currentLotId)
      : null;

  if (
    opts.liveSession &&
    isSaleroomSessionLive(opts.liveSession.status) &&
    onBlockLot &&
    opts.catalogLotRefs.length > 0
  ) {
    const lotNum = onBlockLot.lotNumber != null ? `Lot ${onBlockLot.lotNumber}` : onBlockLot.title;
    return `· ${lotNum} on the block · ${opts.catalogLotRefs.length} lots`;
  }

  if (hero.isLive && typeof hero.liveLotsCount === "number" && hero.liveLotsCount > 0) {
    return hero.liveLotsCount === 1 ? "· 1 lot live" : `· ${hero.liveLotsCount} lots live`;
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
  hero: Pick<SaleHeroVM, "itemsLabel" | "estimatedTotalLabel" | "registeredBidderCount">,
): readonly (readonly [string, string])[] {
  const stats: (readonly [string, string])[] = [["Total Lots", hero.itemsLabel]];
  if (hero.estimatedTotalLabel) {
    stats.push(["Est. Total", hero.estimatedTotalLabel]);
  }
  if (typeof hero.registeredBidderCount === "number" && hero.registeredBidderCount > 0) {
    stats.push([
      "Registered",
      hero.registeredBidderCount === 1 ? "1 bidder" : `${hero.registeredBidderCount} bidders`,
    ]);
  }
  return stats;
}
