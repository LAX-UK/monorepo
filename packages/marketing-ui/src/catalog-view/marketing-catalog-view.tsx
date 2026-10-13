"use client";

import { type CatalogLayoutView, ViewSwitcher } from "@auction/ui";
import type { ReactNode } from "react";
import { useCatalogLayoutView, useCatalogViewNavigation } from "./use-catalog-view.js";

const GRID_LIST: readonly CatalogLayoutView[] = ["grid", "list"];

export type MarketingCatalogViewSwitcherProps = {
  /** Cookie scope (`lax_view_<routeKey>`). */
  routeKey: string;
  /** Server-resolved view; the live value comes from the URL without an RSC round-trip. */
  value: CatalogLayoutView;
  modes?: readonly CatalogLayoutView[];
  defaultView?: CatalogLayoutView;
  /** Params removed on view change. Cursor-paginated surfaces pass `[]` to keep the page. */
  clearParams?: readonly string[];
};

/** Toolbar `trailing` control — Bid's grid/list switcher for every LAX catalogue. */
export function MarketingCatalogViewSwitcher({
  routeKey,
  value,
  modes = GRID_LIST,
  defaultView = "grid",
  clearParams,
}: MarketingCatalogViewSwitcherProps) {
  const liveView = useCatalogLayoutView(defaultView, value) as CatalogLayoutView;
  const { navigate, pending } = useCatalogViewNavigation({
    routeKey,
    defaultView,
    ...(clearParams ? { clearParams } : {}),
  });

  return (
    <ViewSwitcher
      value={modes.includes(liveView) ? liveView : defaultView}
      onValueChange={navigate}
      modes={modes}
      disabled={pending}
    />
  );
}

export type MarketingCatalogViewProps = {
  value: CatalogLayoutView;
  defaultView?: CatalogLayoutView;
  /** Server-rendered layouts; only the active one is mounted. */
  grid: ReactNode;
  list: ReactNode;
};

/**
 * Swaps server-rendered grid and list slots on the live `?view=` value, so cards stay server
 * components and switching needs no refetch.
 */
export function MarketingCatalogView({
  value,
  defaultView = "grid",
  grid,
  list,
}: MarketingCatalogViewProps) {
  const liveView = useCatalogLayoutView(defaultView, value);
  return <>{liveView === "list" ? list : grid}</>;
}
