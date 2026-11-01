"use client";

import { SaleroomLotQuickLookCorner } from "@/components/marketing/lot-quick-look/saleroom-lot-quick-look-corner";
import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import { SaleroomLiveLotBanner } from "@/components/sections/saleroom/saleroom-live-lot-banner";
import { SaleroomLotActions } from "@/components/sections/saleroom/saleroom-lot-actions";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { lotShowsBidAction } from "@/lib/lot/lot-bid-action";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { isSaleroomSessionActive } from "@/lib/saleroom/public-session-status";
import { cn } from "@auction/ui";

type Props = {
  view: CatalogLayoutView;
  /** The catalogue in display order: lots, with withdrawn lots at their place. */
  rows: CatalogueRow<SaleLotCardVM>[];
  saleForLifecycle: SaleroomSaleForLifecycle;
  isAuthenticated: boolean;
  /** When false (staff viewers), hide per-lot bid CTAs. Defaults to true. */
  canParticipate?: boolean;
  emptyMessage?: string;
  clearFiltersHref?: string | null;
};

export function SaleroomCatalogLotsLive({
  rows,
  saleForLifecycle,
  view: initialView,
  isAuthenticated,
  canParticipate = true,
  emptyMessage,
  clearFiltersHref,
}: Props) {
  const view = useUrlLayoutView("grid", initialView) as CatalogLayoutView;
  const live = useSaleroomLive();
  const currentLotId = live?.currentLotId ?? null;
  const nextLotId = live?.nextLotId ?? null;

  const lots = rows.flatMap((row) => (row.kind === "lot" ? [row.lot] : []));
  const onBlockFirst =
    currentLotId != null
      ? [...rows].sort((a, b) => {
          if (a.kind === "lot" && a.lot.id === currentLotId) return -1;
          if (b.kind === "lot" && b.lot.id === currentLotId) return 1;
          return 0;
        })
      : rows;

  const bannerLots = lots.map((lot) => {
    const patch = live?.endedLotPatches[lot.id];
    return {
      id: lot.id,
      lotNumber: lot.lotNumber ?? null,
      title: lot.title,
      href: lot.href,
      status: patch ? patch.status : lot.status,
    };
  });

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
        saleForLifecycle={saleForLifecycle}
        isAuthenticated={isAuthenticated}
        {...(emptyMessage !== undefined ? { emptyMessage } : {})}
        {...(clearFiltersHref !== undefined ? { clearFiltersHref } : {})}
        rows={onBlockFirst.map((row): CatalogueRow<SaleLotCardVM> => {
          if (row.kind === "withdrawn") return row;
          const lot = row.lot;
          const patch = live?.endedLotPatches[lot.id];
          return {
            ...row,
            lot: {
              ...lot,
              ...(patch
                ? {
                    status: patch.status,
                    winnerId: patch.winnerId,
                    hasWinner: patch.hasWinner,
                    isLive: false,
                  }
                : {}),
              isOnBlock: lot.id === currentLotId,
              isUpNext: lot.id === nextLotId,
            },
          };
        })}
        renderCorner={(lot) => (
          <SaleroomLotQuickLookCorner lot={lot} isAuthenticated={isAuthenticated} />
        )}
        renderActions={(lot) =>
          canParticipate && lotShowsBidAction(lot.status) ? (
            <SaleroomLotActions lotHref={lot.href} />
          ) : null
        }
      />
    </>
  );
}
