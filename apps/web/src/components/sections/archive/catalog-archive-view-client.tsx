"use client";

import {
  CatalogArchiveView,
  type CatalogArchiveViewProps,
} from "@/components/sections/archive/catalog-archive-view";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

type Props = Omit<CatalogArchiveViewProps, "view"> & {
  initialView: CatalogLayoutView;
  defaultView?: CatalogLayoutView;
};

export function CatalogArchiveViewClient({ initialView, defaultView = "grid", ...props }: Props) {
  const view = useUrlLayoutView(defaultView, initialView) as CatalogLayoutView;
  return <CatalogArchiveView {...props} view={view} />;
}
