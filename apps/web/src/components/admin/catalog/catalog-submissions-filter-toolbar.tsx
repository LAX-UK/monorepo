"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  initialQ: string;
  queue: SubmissionDecisionQueue;
};

export function CatalogSubmissionsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  initialQ,
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
      sheetFilters={<AdminSubmissionsTitleFilterForm initialQ={initialQ} queue={queue} />}
    />
  );
}
