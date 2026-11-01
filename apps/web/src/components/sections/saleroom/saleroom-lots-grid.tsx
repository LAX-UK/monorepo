import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import { MarketingCardReveal } from "@auction/marketing-ui";
import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import { SaleroomWithdrawnRow } from "./saleroom-withdrawn-row";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  rows: CatalogueRow<SaleLotCardVM>[];
  saleForLifecycle: SaleroomSaleForLifecycle;
  renderCorner?: (lot: SaleLotCardVM) => ReactNode;
  /** OCP: callers render action slot per lot (Bid vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
};

/** Pure layout: Figma 4-up at xl; 32px column gap, 49px row gap.
 */
export function SaleroomLotsGrid({
  rows,
  saleForLifecycle,
  renderCorner,
  renderActions,
  emptyMessage = "No lots in this section yet.",
}: Props) {
  if (rows.length === 0) {
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
  const lotCards = rows.flatMap((entry) => (entry.kind === "lot" ? [entry.lot] : []));
  const renderLot = (lot: SaleLotCardVM, index: number) => (
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
  );

  // Without a withdrawn lot the grid keeps its sparse columns and equal row heights. With one, the
  // slim row spans the full width between the tiles, so rows size to their own content.
  if (lotCards.length === rows.length) {
    return (
      <MarketingCatalogGrid
        count={lotCards.length}
        gridClassName="gap-x-3 gap-y-6 md:gap-x-7 md:gap-y-10"
        multi="grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {lotCards.map(renderLot)}
      </MarketingCatalogGrid>
    );
  }

  let lotIndex = 0;
  return (
    <ul className="grid list-none grid-cols-1 gap-x-3 gap-y-6 p-0 sm:grid-cols-2 md:gap-x-7 md:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((entry) =>
        entry.kind === "withdrawn" ? (
          <li key={entry.key} className="col-span-full">
            <SaleroomWithdrawnRow row={entry.row} layout="grid" />
          </li>
        ) : (
          <li key={entry.key} className="flex min-w-0 flex-col">
            {renderLot(entry.lot, lotIndex++)}
          </li>
        ),
      )}
    </ul>
  );
}
