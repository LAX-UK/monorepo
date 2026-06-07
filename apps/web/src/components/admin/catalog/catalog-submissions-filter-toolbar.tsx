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
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { CategoryNode } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  initialQ: string;
  initialCategoryId?: string | null;
  categories: CategoryNode[];
  queue: SubmissionDecisionQueue;
  qualityGaps?: boolean;
  assignedToMe?: boolean;
  sortBySla?: boolean;
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
  qualityGaps = false,
  assignedToMe = false,
  sortBySla = false,
}: Props) {
  const searchParams = useSearchParams();
  const sp: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const qualityGapsHref = buildListHref("/admin/submissions", sp, {
    qualityGaps: qualityGaps ? "" : "1",
    offset: 0,
    queue,
  });
  const myQueueHref = buildListHref("/admin/submissions", sp, {
    assignedTo: assignedToMe ? "" : "me",
    offset: 0,
    queue,
  });
  const sortBySlaHref = buildListHref("/admin/submissions", sp, {
    sort: sortBySla ? "" : "sla",
    offset: 0,
    queue,
  });

  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Submission queue"
      sheetTitle="Submission filters"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search submissions…" className="w-full" />}
      toolbarEnd={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant={assignedToMe ? "secondary" : "secondaryOutline"}
            size="sm"
            className="min-h-11"
            asChild
            aria-pressed={assignedToMe}
          >
            <Link href={myQueueHref}>My queue</Link>
          </Button>
          <Button
            variant={sortBySla ? "secondary" : "secondaryOutline"}
            size="sm"
            className="min-h-11"
            asChild
            aria-pressed={sortBySla}
          >
            <Link href={sortBySlaHref}>Sort by SLA</Link>
          </Button>
          <Button
            variant={qualityGaps ? "secondary" : "secondaryOutline"}
            size="sm"
            className="min-h-11"
            asChild
            aria-pressed={qualityGaps}
          >
            <Link href={qualityGapsHref}>Quality gaps</Link>
          </Button>
        </div>
      }
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={
        <AdminSubmissionsTitleFilterForm
          initialQ={initialQ}
          initialCategoryId={initialCategoryId}
          categories={categories}
          queue={queue}
          qualityGaps={qualityGaps}
          assignedToMe={assignedToMe}
          sortBySla={sortBySla}
        />
      }
    />
  );
}
