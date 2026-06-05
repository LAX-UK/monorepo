"use client";

import { CatalogLotView, type CatalogLotViewProps } from "@/components/marketing/catalog-lot-view";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

type Props = Omit<CatalogLotViewProps, "view"> & {
  initialView: CatalogLayoutView;
  defaultView?: CatalogLayoutView;
};

/** Client-bound catalogue results that react to `?view=` without a server refetch. */
export function CatalogLotViewClient({ initialView, defaultView = "grid", ...props }: Props) {
  const view = useUrlLayoutView(defaultView, initialView) as CatalogLayoutView;
  return <CatalogLotView {...props} view={view} />;
}
