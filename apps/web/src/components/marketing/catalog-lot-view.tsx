import { CatalogByView } from "@/components/marketing/catalog-by-view";
import {
  CatalogLotCardView,
  CatalogLotGridView,
  CatalogLotListView,
  type CatalogLotViewsProps,
} from "@/components/marketing/catalog-lot-views";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export type CatalogLotViewProps = CatalogLotViewsProps & {
  view: CatalogLayoutView;
};

/** Dispatcher for marketing lot catalog surfaces (search, etc.). */
export function CatalogLotView({
  view,
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: CatalogLotViewProps) {
  const viewProps = {
    lots,
    currentUserId,
    isAuthenticated,
    watchedLotIds,
    loginNextPath,
  };

  return (
    <CatalogByView
      view={view}
      items={lots}
      renderList={(items) => <CatalogLotListView {...viewProps} lots={items} />}
      renderGrid={(items) => <CatalogLotGridView {...viewProps} lots={items} />}
      renderCard={(items) => <CatalogLotCardView {...viewProps} lots={items} />}
    />
  );
}
