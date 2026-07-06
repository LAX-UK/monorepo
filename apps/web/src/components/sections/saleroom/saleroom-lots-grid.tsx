import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lots: SaleLotCardVM[];
  saleForLifecycle: SaleroomSaleForLifecycle;
  renderCorner?: (lot: SaleLotCardVM) => ReactNode;
  /** OCP: callers render action slot per lot (Bid vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
};

/** Pure layout: Figma 4-up at xl; 32px column gap, 49px row gap.
 */
export function SaleroomLotsGrid({
  lots,
  saleForLifecycle,
  renderCorner,
  renderActions,
  emptyMessage = "No lots in this section yet.",
}: Props) {
  if (lots.length === 0) {
    return (
      <MarketingEmptyState
        variant="marketing"
        className="py-4"
        context="noResults"
        illustration="lots"
        title={emptyMessage}
        description="Lots will appear here when they are listed in this section."
      />
    );
  }
  return (
    <MarketingCatalogGrid
      count={lots.length}
      gridClassName="gap-x-3 gap-y-6 md:gap-x-7 md:gap-y-10"
      multi="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {lots.map((lot, index) => (
        <MarketingCardReveal
          key={lot.id}
          index={index}
          className="h-full w-full"
          innerClassName="flex h-full min-w-0 flex-col"
        >
          <SaleroomLotCard
            lot={lot}
            saleForLifecycle={saleForLifecycle}
            cornerAction={renderCorner?.(lot)}
            actions={renderActions?.(lot)}
          />
        </MarketingCardReveal>
      ))}
    </MarketingCatalogGrid>
  );
}
