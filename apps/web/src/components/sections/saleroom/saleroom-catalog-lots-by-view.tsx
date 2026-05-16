import { CatalogByView } from "@/components/marketing/catalog-by-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
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
};

export function SaleroomCatalogLotsByView({
  view,
  lots,
  renderCorner,
  renderActions,
  emptyMessage,
}: Props) {
  const resolvedEmpty = emptyMessage ?? "No lots in this section yet.";

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
