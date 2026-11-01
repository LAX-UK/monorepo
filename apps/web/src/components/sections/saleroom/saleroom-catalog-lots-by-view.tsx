import { CatalogByView } from "@/components/marketing/catalog-by-view";
import { SaleroomLotListActions } from "@/components/marketing/lot-quick-look/saleroom-lot-list-actions";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { SaleroomSaleForLifecycle } from "@/components/sections/saleroom/saleroom-lot-catalog-overlay";
import type { CatalogueRow } from "@/lib/marketing/saleroom/catalogue-rows";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";
import { SaleroomLotCard } from "./saleroom-lot-card";
import { SaleroomLotsGrid } from "./saleroom-lots-grid";
import { SaleroomWithdrawnRow } from "./saleroom-withdrawn-row";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  view: CatalogLayoutView;
  rows: CatalogueRow<SaleLotCardVM>[];
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
  rows,
  saleForLifecycle,
  isAuthenticated,
  renderCorner,
  renderActions,
  emptyMessage,
  clearFiltersHref,
}: Props) {
  const resolvedEmpty =
    rows.length === 0 ? (
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
            <ButtonLink Link={Link} variant="primary" href={clearFiltersHref}>
              Clear filters
            </ButtonLink>
          ) : undefined
        }
      />
    ) : null;

  return (
    <CatalogByView
      view={view}
      items={rows}
      emptyMessage={resolvedEmpty}
      renderList={(items) => (
        <ul className="list-none divide-y divide-outline-variant/10 p-0">
          {items.map((entry) => (
            <li key={entry.key} className="px-0">
              {entry.kind === "withdrawn" ? (
                <SaleroomWithdrawnRow row={entry.row} layout="list" />
              ) : (
                <SaleroomLotCard
                  lot={entry.lot}
                  saleForLifecycle={saleForLifecycle}
                  listActions={
                    renderCorner ? (
                      <SaleroomLotListActions lot={entry.lot} isAuthenticated={isAuthenticated} />
                    ) : undefined
                  }
                  actions={renderActions?.(entry.lot)}
                  layout="row"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      renderGrid={(items) => (
        <SaleroomLotsGrid
          rows={items}
          saleForLifecycle={saleForLifecycle}
          {...(renderCorner ? { renderCorner } : {})}
          {...(renderActions ? { renderActions } : {})}
          {...(emptyMessage !== undefined ? { emptyMessage } : {})}
        />
      )}
    />
  );
}
