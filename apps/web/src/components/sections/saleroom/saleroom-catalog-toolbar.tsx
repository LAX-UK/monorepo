"use client";

import { SaleroomCatalogStatusChips } from "@/components/sections/saleroom/saleroom-catalog-status-chips";

type Props = {
  /** Path of the current saleroom (e.g. `/sales/abc/123`). */
  basePath: string;
};

export function SaleroomCatalogToolbar({ basePath }: Props) {
  return <SaleroomCatalogStatusChips basePath={basePath} layout="strip" />;
}
