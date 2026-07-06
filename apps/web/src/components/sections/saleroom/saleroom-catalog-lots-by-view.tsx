import { CatalogByView } from "@/components/marketing/catalog-by-view";
import { SaleroomLotListActions } from "@/components/marketing/lot-quick-look/saleroom-lot-list-actions";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { Button } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import { SaleroomLotsGrid } from "./saleroom-lots-grid";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  view: CatalogLayoutView;
  lots: SaleLotCardVM[];
  saleForLifecycle: SaleroomSaleForLifecycle;
  isAuthenticated: boolean;
  /** OCP: grid image overlays (watchlist + quick-look on tile). */
  renderCorner?: (lot: SaleLotCardVM) => ReactNode;
  /** OCP: callers render action slot per lot (Bid vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
  clearFiltersHref?: string | null;
};

export function SaleroomCatalogLotsByView({
  view,
  lots,
  saleForLifecycle,
  isAuthenticated,
  renderCorner,
  renderActions,
  emptyMessage,
  clearFiltersHref,
}: Props) {
  const resolvedEmpty =
    lots.length === 0 ? (
      <MarketingEmptyState
        variant="marketing"
        context={clearFiltersHref ? "filtered" : "noResults"}
        title={emptyMessage ?? "No lots match these filters"}
        description={
          clearFiltersHref
            ? "Try clearing filters to see all lots in this sale."
            : "Lots will appear here when they are published to this sale."
        }
        action={
          clearFiltersHref ? (
            <Button variant="cta" asChild>
              <Link href={clearFiltersHref}>Clear filters</Link>
            </Button>
          ) : undefined
        }
      />
    ) : null;

  return (
    <CatalogByView
      view={view}
      items={lots}
      emptyMessage={resolvedEmpty}
      renderList={(items) => (
        <ul className="list-none divide-y divide-outline-variant/10 p-0">
          {items.map((lot) => (
            <li key={lot.id} className="px-0">
              <SaleroomLotCard
                lot={lot}
                saleForLifecycle={saleForLifecycle}
                listActions={
                  renderCorner ? (
                    <SaleroomLotListActions lot={lot} isAuthenticated={isAuthenticated} />
                  ) : undefined
                }
                actions={renderActions?.(lot)}
                layout="row"
              />
            </li>
          ))}
        </ul>
      )}
      renderGrid={(items) => (
        <SaleroomLotsGrid
          lots={items}
          saleForLifecycle={saleForLifecycle}
          {...(renderCorner ? { renderCorner } : {})}
          {...(renderActions ? { renderActions } : {})}
          {...(emptyMessage !== undefined ? { emptyMessage } : {})}
        />
      )}
    />
  );
}
