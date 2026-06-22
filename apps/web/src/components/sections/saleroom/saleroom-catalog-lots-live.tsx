"use client";

import { SaleroomLotQuickLookCorner } from "@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner";
import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import { SaleroomLiveLotBanner } from "@/components/sections/saleroom/saleroom-live-lot-banner";
import { SaleroomLotActions } from "@/components/sections/saleroom/saleroom-lot-actions";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { isSaleroomSessionActive } from "@/lib/saleroom/public-session-status";
import { cn } from "@auction/ui";

type Props = {
  view: CatalogLayoutView;
  lots: SaleLotCardVM[];
  isAuthenticated: boolean;
  /** When false (staff viewers), hide per-lot bid CTAs. Defaults to true. */
  canParticipate?: boolean;
  emptyMessage?: string;
  clearFiltersHref?: string | null;
};

export function SaleroomCatalogLotsLive({
  lots,
  view: initialView,
  isAuthenticated,
  canParticipate = true,
  emptyMessage,
  clearFiltersHref,
}: Props) {
  const view = useUrlLayoutView("grid", initialView) as CatalogLayoutView;
  const live = useSaleroomLive();
  const currentLotId = live?.currentLotId ?? null;

  const sortedLots =
    currentLotId != null
      ? [...lots].sort((a, b) => {
          if (a.id === currentLotId) return -1;
          if (b.id === currentLotId) return 1;
          return 0;
        })
      : lots;

  const bannerLots = lots.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber ?? null,
    title: lot.title,
    href: lot.href,
    status: lot.status,
  }));

  const hideBannerOnMobile = live != null && isSaleroomSessionActive(live.status);

  return (
    <>
      <SaleroomLiveLotBanner
        lots={bannerLots}
        canParticipate={canParticipate}
        className={cn(hideBannerOnMobile && "max-lg:hidden")}
      />
      <SaleroomCatalogLotsByView
        view={view}
        isAuthenticated={isAuthenticated}
        {...(emptyMessage !== undefined ? { emptyMessage } : {})}
        {...(clearFiltersHref !== undefined ? { clearFiltersHref } : {})}
        lots={sortedLots.map((lot) => ({
          ...lot,
          isOnBlock: lot.id === currentLotId,
        }))}
        renderCorner={(lot) => (
          <SaleroomLotQuickLookCorner lot={lot} isAuthenticated={isAuthenticated} />
        )}
        renderActions={(lot) => (canParticipate ? <SaleroomLotActions lotHref={lot.href} /> : null)}
      />
    </>
  );
}
