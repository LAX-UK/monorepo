import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";
import type { ReactNode } from "react";

export type CatalogTableFilterControlsBaseProps = {
  searchPlaceholder: string;
  sheetTitle?: string;
  activeFilterCount: number;
  searchInputId?: string;
};

export type CatalogTableTransactionalConfig = {
  // biome-ignore lint/suspicious/noExplicitAny: shared chrome intentionally erases each adapter's draft type.
  adapter: AdminFilterAdapter<any>;
  preserved: AdminFilterPreserved;
};

export type CatalogTableFilterControlsProps = CatalogTableFilterControlsBaseProps & {
  sheetFilters: ReactNode;
  transactional?: CatalogTableTransactionalConfig;
  toolbarMid?: ReactNode;
  toolbarMidMobile?: ReactNode;
};
