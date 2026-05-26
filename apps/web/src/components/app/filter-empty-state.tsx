"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { EmptyStateIllustrationKey } from "@/components/illustrations/empty-state-illustrations";
import { EMPTY_STATE_VOICE } from "@/lib/ui/empty-state-copy";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type FilterEmptyStateProps = {
  /** Plural entity label, e.g. "submissions" → "No submissions match this filter". */
  entity: string;
  segment: "admin" | "dashboard";
  title?: string;
  description?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersHref?: string;
  illustration?: EmptyStateIllustrationKey;
  browseHref?: string;
  browseLabel?: string;
};

/** Table/list empty state when filters yield no rows. */
export function FilterEmptyState({
  entity,
  segment,
  title,
  description,
  hasActiveFilters = true,
  onClearFilters,
  clearFiltersHref,
  illustration = "search",
  browseHref,
  browseLabel,
}: FilterEmptyStateProps) {
  const resolvedTitle = title ?? EMPTY_STATE_VOICE.filteredTitle(entity);
  const resolvedDescription =
    description ??
    (hasActiveFilters
      ? "Try clearing filters or adjusting your search."
      : "There is nothing to show in this view yet.");

  const action = (
    <div className="flex flex-wrap justify-center gap-2">
      {hasActiveFilters && onClearFilters ? (
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
      {hasActiveFilters && clearFiltersHref ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={clearFiltersHref}>Clear filters</Link>
        </Button>
      ) : null}
      {browseHref && browseLabel ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={browseHref}>{browseLabel}</Link>
        </Button>
      ) : null}
    </div>
  );

  if (segment === "admin") {
    return (
      <AdminEmptyState
        context="filtered"
        illustration={illustration}
        title={resolvedTitle}
        description={resolvedDescription}
        action={action}
      />
    );
  }

  return (
    <DashboardEmptyState
      context="filtered"
      illustration={illustration}
      title={resolvedTitle}
      description={resolvedDescription}
      action={action}
    />
  );
}
