"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import type { CategoryNode } from "@auction/types";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  initialQ: string;
  initialCategoryId?: string | null;
  categories: CategoryNode[];
  queue: SubmissionDecisionQueue;
};

export function CatalogSubmissionsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  initialQ,
  initialCategoryId = null,
  categories,
  queue,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Submission queue"
      sheetTitle="Submission filters"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search submissions…" className="w-full" />}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={
        <AdminSubmissionsTitleFilterForm
          initialQ={initialQ}
          initialCategoryId={initialCategoryId}
          categories={categories}
          queue={queue}
        />
      }
    />
  );
}
