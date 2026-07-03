import { formatEstimateRange, formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { isLotAdvanceable } from "@/lib/saleroom/lot-run-progress";
import {
  type PublicSaleroomSessionStatus,
  isSaleroomSessionActive,
} from "@/lib/saleroom/public-session-status";
import { sortLotsForRunList } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot, PublicLotView } from "@auction/types";
import { resolveLotHref, sortSaleLotsForNav } from "./shared";

/** Single lot row in the online session queue (sidebar or horizontal rail). */
export type LotQueueCardVM = {
  id: string;
  href: string;
  lotNumber: number | null;
  title: string;
  artistName: string;
  imageUrl: string | null;
  estimateLine: string | null;
  currentBid: string | null;
  isCurrentLot: boolean;
  isUpNext: boolean;
};

function lotToQueueCardVM(
  lot: Lot | PublicLotView,
  artistName: string,
  flags: { isCurrentLot: boolean; isUpNext: boolean },
  catalogLinkParams?: CatalogLinkParams,
): LotQueueCardVM {
  const est = lot.marketingDetails.estimate;
  return {
    id: lot.id,
    href: resolveLotHref(lot, catalogLinkParams),
    lotNumber: lot.lotNumber,
    title: lot.title,
    artistName,
    imageUrl: lot.images[0] ?? null,
    estimateLine: est ? formatEstimateRange(est) : null,
    currentBid: lot.currentPrice ? formatMoney(lot.currentPrice, resolveLotCurrency(lot)) : null,
    isCurrentLot: flags.isCurrentLot,
    isUpNext: flags.isUpNext,
  };
}

/** Lots that may still appear in Up next / Queue (not finished or unpublished). */
function isQueueEligibleStatus(status: Lot["status"]): boolean {
  return status === "active" || status === "scheduled";
}

/** Build queue VMs for the current sale (ordered nav); empty when not in a sale.
 * Up next and Queue only include lots that are `active` or `scheduled` (in catalog order after the current lot).
 */
export function mapSaleLotsToQueueVMs(
  currentLot: Lot | PublicLotView,
  saleLots: Lot[] | null,
  resolveArtistName: (l: Lot | PublicLotView) => string,
  catalogLinkParams?: CatalogLinkParams,
): { current: LotQueueCardVM; upNext: LotQueueCardVM | null; queue: LotQueueCardVM[] } {
  const ordered = sortSaleLotsForNav(saleLots?.filter((l) => l.saleId === currentLot.saleId) ?? []);
  const idx = ordered.findIndex((l) => l.id === currentLot.id);
  if (idx < 0) {
    const solo = lotToQueueCardVM(
      currentLot,
      resolveArtistName(currentLot),
      {
        isCurrentLot: true,
        isUpNext: false,
      },
      catalogLinkParams,
    );
    return { current: solo, upNext: null, queue: [] };
  }
  const cur = ordered[idx];
  if (!cur) {
    const solo = lotToQueueCardVM(
      currentLot,
      resolveArtistName(currentLot),
      {
        isCurrentLot: true,
        isUpNext: false,
      },
      catalogLinkParams,
    );
    return { current: solo, upNext: null, queue: [] };
  }
  const current = lotToQueueCardVM(
    cur,
    resolveArtistName(cur),
    {
      isCurrentLot: true,
      isUpNext: false,
    },
    catalogLinkParams,
  );
  const afterCurrent = ordered.slice(idx + 1);
  const upcoming = afterCurrent.filter((l) => isQueueEligibleStatus(l.status));
  const nextLot = upcoming[0] ?? null;
  const upNext = nextLot
    ? lotToQueueCardVM(
        nextLot,
        resolveArtistName(nextLot),
        { isCurrentLot: false, isUpNext: true },
        catalogLinkParams,
      )
    : null;
  const queue = upcoming
    .slice(1)
    .map((l) =>
      lotToQueueCardVM(
        l,
        resolveArtistName(l),
        { isCurrentLot: false, isUpNext: false },
        catalogLinkParams,
      ),
    );
  return { current, upNext, queue };
}

/** Live hybrid saleroom queue — anchored on floor on-block lot, not the viewed lot. */
export function mapSaleLotsToSaleroomQueueVMs(
  saleLots: Lot[],
  currentLotId: string | null,
  sessionStatus: PublicSaleroomSessionStatus["status"],
  resolveArtistName: (l: Lot | PublicLotView) => string,
  catalogLinkParams?: CatalogLinkParams,
): { upNext: LotQueueCardVM | null; queue: LotQueueCardVM[] } | null {
  if (!isSaleroomSessionActive(sessionStatus) || saleLots.length === 0) return null;

  const ordered = sortLotsForRunList(saleLots);
  const afterOnBlock =
    currentLotId != null
      ? (() => {
          const idx = ordered.findIndex((l) => l.id === currentLotId);
          return idx >= 0 ? ordered.slice(idx + 1) : ordered;
        })()
      : ordered;

  const upcoming = afterOnBlock.filter((l) => isLotAdvanceable(l));
  const nextLot = upcoming[0] ?? null;
  const upNext = nextLot
    ? lotToQueueCardVM(
        nextLot,
        resolveArtistName(nextLot),
        { isCurrentLot: false, isUpNext: true },
        catalogLinkParams,
      )
    : null;
  const queue = upcoming
    .slice(1)
    .map((l) =>
      lotToQueueCardVM(
        l,
        resolveArtistName(l),
        { isCurrentLot: false, isUpNext: false },
        catalogLinkParams,
      ),
    );
  return { upNext, queue };
}
