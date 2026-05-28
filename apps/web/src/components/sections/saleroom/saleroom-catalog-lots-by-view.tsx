import { CatalogByView } from "@/components/marketing/catalog-by-view";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
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
  /** OCP: callers render watchlist heart (or similar) on the image corner. */
  renderCorner?: (lot: SaleLotCardVM) => ReactNode;
  /** OCP: callers render action slot per lot (Bid vs Results). */
  renderActions?: (lot: SaleLotCardVM) => ReactNode;
  emptyMessage?: string;
  clearFiltersHref?: string | null;
};

export function SaleroomCatalogLotsByView({
  view,
  lots,
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
            <Button variant="outline" asChild>
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
                cornerAction={renderCorner?.(lot)}
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
          {...(renderCorner ? { renderCorner } : {})}
          {...(renderActions ? { renderActions } : {})}
          {...(emptyMessage !== undefined ? { emptyMessage } : {})}
        />
      )}
    />
  );
}
