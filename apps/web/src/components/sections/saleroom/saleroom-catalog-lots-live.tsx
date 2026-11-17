"use client";

import { LotCardAction } from "@/components/lot-card/lot-card-action";
import { saleroomLotCardExtras } from "@/components/marketing/lot-quick-look/saleroom-lot-card-extras";
import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import { SaleroomLiveLotBanner } from "@/components/sections/saleroom/saleroom-live-lot-banner";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { type LotCardBidViewer, lotCardBidAction } from "@/lib/lot-card/lot-card-bid-action";
import { withLiveCardFields } from "@/lib/marketing/saleroom/card-live-state";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import {
  type SaleCatalogueLiveInput,
  useSaleCatalogueLive,
} from "@/lib/marketing/saleroom/sale-catalogue-live.client";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { isSaleroomSessionActive } from "@/lib/saleroom/public-session-status";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  view: CatalogLayoutView;
  /** The catalogue in display order: lots, with withdrawn lots at their place. */
  rows: CatalogueRow<SaleLotCardVM>[];
  saleForLifecycle: SaleroomSaleForLifecycle;
  isAuthenticated: boolean;
  /** When false (staff viewers), hide per-lot bid CTAs. Defaults to true. */
  canParticipate?: boolean;
  /**
   * Who is looking, for the card button's label before a lot opens; `null` until the viewer read
   * answers (the button's place is kept meanwhile).
   */
  bidViewer?: LotCardBidViewer;
  /**
   * The sale takes web registrations now (`registerToBidSale`). With the sale's mode it says
   * whether a card could ever ask someone to register, before the viewer read answers.
   */
  registrationOffered?: boolean;
  emptyMessage?: string;
  clearFiltersHref?: string | null;
  /**
   * The no-store read that fills the cards' placeholders (CO-7: the page carries no bid state).
   * Left out, the cards are drawn as they came.
   */
  live?: SaleCatalogueLiveInput | null;
};

export function SaleroomCatalogLotsLive({
  rows: initialRows,
  saleForLifecycle,
  view: initialView,
  isAuthenticated,
  canParticipate = true,
  bidViewer = null,
  registrationOffered = true,
  emptyMessage,
  clearFiltersHref,
  live: liveRead = null,
}: Props) {
  const view = useUrlLayoutView("grid", initialView) as CatalogLayoutView;
  const live = useSaleroomLive();
  const liveCards = useSaleCatalogueLive(liveRead);
  const rows = initialRows.map(
    (row): CatalogueRow<SaleLotCardVM> =>
      row.kind === "lot" ? { ...row, lot: withLiveCardFields(row.lot, liveCards) } : row,
  );
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
        renderExtras={(lot) => saleroomLotCardExtras(lot, isAuthenticated)}
        renderActions={(lot) => {
          if (!canParticipate) return null;
          const action = lot.pending
            ? ({ kind: "pending" } as const)
            : lotCardBidAction({
                lotStatus: lot.status,
                lotHref: lot.href,
                sale: saleForLifecycle ? { ...saleForLifecycle, registrationOffered } : null,
                viewer: bidViewer,
              });
          if (!action) return null;
          // The button waits for the live state or the viewer; its place is kept so nothing moves.
          if (action.kind === "pending") {
            return <Skeleton className="h-lax-control-md w-full rounded-lax-control" />;
          }
          return <LotCardAction action={action} />;
        }}
      />
    </>
  );
}
