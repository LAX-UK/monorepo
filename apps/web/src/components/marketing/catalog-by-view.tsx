import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { ReactNode } from "react";

export type CatalogByViewProps<T> = {
  view: CatalogLayoutView;
  items: T[];
  renderGrid: (items: T[]) => ReactNode;
  renderList: (items: T[]) => ReactNode;
  renderCard?: (items: T[]) => ReactNode;
  /** When set, empty `items` renders this instead of delegating to renderers. */
  emptyMessage?: ReactNode;
};

function renderEmptyMessage(message: ReactNode) {
  if (typeof message === "string") {
    return <p className="py-12 text-center text-on-surface-variant">{message}</p>;
  }
  return message;
}

/** Shared view dispatcher for catalog-style grids (marketing search, saleroom, etc.). */
export function CatalogByView<T>({
  view,
  items,
  renderGrid,
  renderList,
  renderCard,
  emptyMessage,
}: CatalogByViewProps<T>) {
  if (items.length === 0 && emptyMessage !== undefined) {
    return renderEmptyMessage(emptyMessage);
  }

  if (view === "list") return renderList(items);
  if (view === "card" && renderCard) return renderCard(items);
  return renderGrid(items);
}
