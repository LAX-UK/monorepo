"use client";

import { AdminFilterBar, type AdminFilterLens } from "@/components/admin/admin-filter-bar";
import type { CatalogSegmentNavProps } from "@/components/admin/catalog/catalog-segment-nav";
import type { CatalogTableTransactionalConfig } from "@/components/admin/catalog/catalog-table-filter-controls";
import type { ReactNode } from "react";

export type { CatalogSegmentItem } from "@/lib/admin/catalog/types";

type Props = {
  lenses?: readonly AdminFilterLens[];
  activeLensId?: string;
  lensAriaLabel?: string;
  sheetTitle?: string;
  sheetFilters?: ReactNode;
  activeFilterCount?: number;
  showSearch?: boolean;
  showFilterTrigger?: boolean;
  searchSlot?: ReactNode;
  activeFilters?: ReactNode;
  toolbarEnd?: ReactNode;
  LensNav?: (props: CatalogSegmentNavProps) => ReactNode;
  className?: string;
  transactional?: CatalogTableTransactionalConfig;
};

/** Catalog list sticky filter chrome — thin adapter over AdminFilterBar. */
export function CatalogFilterBar(props: Props) {
  return <AdminFilterBar {...props} />;
}
