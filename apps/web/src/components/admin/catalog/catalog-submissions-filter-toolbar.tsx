"use client";

import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import type { ItemSubmissionStatus } from "@auction/types";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  initialQ: string;
  queue?: SubmissionDecisionQueue;
  status?: ItemSubmissionStatus;
};

export function CatalogSubmissionsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  initialQ,
  queue,
  status,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Submission queue"
      sheetTitle="Submission filters"
      activeFilterCount={activeFilterCount}
      sheetFilters={
        <AdminSubmissionsTitleFilterForm
          initialQ={initialQ}
          {...(queue !== undefined ? { queue } : {})}
          {...(status !== undefined ? { status } : {})}
        />
      }
    />
  );
}
