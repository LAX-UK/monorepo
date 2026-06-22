"use client";

import {
  CatalogArtistView,
  type CatalogArtistViewProps,
} from "@/components/sections/artists/catalog-artist-view";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

type Props = Omit<CatalogArtistViewProps, "view"> & {
  initialView: CatalogLayoutView;
  defaultView?: CatalogLayoutView;
};

/** Client-bound artist directory results that react to `?view=` without a server refetch. */
export function CatalogArtistViewClient({ initialView, defaultView = "grid", ...props }: Props) {
  const view = useUrlLayoutView(defaultView, initialView) as CatalogLayoutView;
  return <CatalogArtistView {...props} view={view} />;
}
