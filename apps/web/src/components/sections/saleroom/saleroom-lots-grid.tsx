import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { RevealInView } from "@/components/ui/reveal";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lots: SaleLotCardVM[];
  renderCorner?: (lot: SaleLotCardVM) => ReactNode;
  /** OCP: callers render action slot per lot (Bid vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
};

/** Pure layout: Figma 4-up at xl; 32px column gap, 49px row gap.
 */
export function SaleroomLotsGrid({
  lots,
  renderCorner,
  renderActions,
  emptyMessage = "No lots in this section yet.",
}: Props) {
  if (lots.length === 0) {
    return (
      <MarketingEmptyState
        className="py-4"
        context="noResults"
        illustration="lots"
        title={emptyMessage}
        description="Lots will appear here when they are listed in this section."
      />
    );
  }
  return (
    <ul
      className={cn(
        "list-none auto-rows-fr items-stretch justify-items-stretch gap-x-3 gap-y-6 p-0 md:gap-x-7 md:gap-y-10",
        sparseGridClasses(lots.length, {
          multi:
            "grid grid-cols-1 gap-x-3 gap-y-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        }),
      )}
    >
      {lots.map((lot, index) => (
        <li key={lot.id} className="flex h-full min-w-0 flex-col">
          <RevealInView
            variant="fadeUp"
            delayMs={index * 70}
            className="h-full w-full"
            innerClassName="flex h-full min-w-0 flex-col"
          >
            <SaleroomLotCard
              lot={lot}
              cornerAction={renderCorner?.(lot)}
              actions={renderActions?.(lot)}
            />
          </RevealInView>
        </li>
      ))}
    </ul>
  );
}
