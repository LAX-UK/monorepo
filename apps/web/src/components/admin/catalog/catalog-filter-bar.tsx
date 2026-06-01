"use client";

import { AdminFilterBar, type AdminFilterLens } from "@/components/admin/admin-filter-bar";
import type { CatalogSegmentNavProps } from "@/components/admin/catalog/catalog-segment-nav";
import type { ReactNode } from "react";

export type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-segment-nav";

type Props = {
  lenses: readonly AdminFilterLens[];
  activeLensId: string;
  lensAriaLabel: string;
  sheetTitle?: string;
  sheetFilters: ReactNode;
  activeFilterCount?: number;
  /** When false, hides the filter sheet trigger (e.g. search-only toolbars). */
  showFilterTrigger?: boolean;
  /** Optional search row shown beside More filters on lg+ */
  searchSlot?: ReactNode;
  /** Chips for applied filters (below lens row). */
  activeFilters?: ReactNode;
  toolbarEnd?: ReactNode;
  /** Override default lens nav (e.g. lots pipeline persistence). */
  LensNav?: (props: CatalogSegmentNavProps) => ReactNode;
  className?: string;
};

/** Catalog list sticky filter chrome — thin adapter over AdminFilterBar. */
export function CatalogFilterBar(props: Props) {
  return <AdminFilterBar {...props} />;
}
