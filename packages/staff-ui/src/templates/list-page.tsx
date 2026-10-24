"use client";

import type * as React from "react";
import { ColumnsMenu, useColumnVisibility, visibleColumns } from "../data/columns-menu.js";
import { DataTable, type DataTableProps } from "../data/data-table.js";
import { rowActionsColumn } from "../data/row-actions.js";
import {
  type ActiveFilter,
  ActiveFilterChips,
  DensityToggle,
  TablePagination,
  useTableDensity,
} from "../data/toolbar.js";
import type { TableDensity } from "../data/types.js";
import { AttentionStrip, type AttentionStripItem } from "../display/attention-strip.js";
import { type Metric, MetricStrip } from "../display/metric-strip.js";
import {
  AccessDeniedState,
  EmptyState,
  ErrorState,
  NoResultsState,
  ViewOnlyBadge,
} from "../display/states.js";
import { StaffButton } from "../primitives/button.js";
import type { StaffLinkComponent } from "../shell/link.js";
import type { OverflowAction } from "../shell/overflow-menu.js";
import { PageHeader } from "../shell/page-header.js";

/** Who is looking: everything, look but not change, or nothing at all. */
export type ListPageAccess = "full" | "read-only" | "denied";

export type ListPageTable<T> = Omit<
  DataTableProps<T>,
  "label" | "toolbar" | "footer" | "empty" | "error" | "loading" | "density"
> & {
  /** The table's accessible name; defaults to the page title. */
  label?: string;
  /** The row's `…` menu: every action for the row, destructive last. */
  rowActions?: {
    actions: (row: T) => readonly OverflowAction[];
    /** "Actions for payment LAX-1042". */
    label: (row: T) => string;
  };
  /** Columns that start hidden; the person can show them from "Columns". */
  defaultHiddenColumns?: readonly string[];
  /** Columns that can never be hidden; defaults to the first. */
  lockedColumns?: readonly string[];
  /** Compact for text-only lists, comfortable for lists with thumbnails. */
  defaultDensity?: TableDensity;
};

export type ListPageProps<T> = {
  title: string;
  /** One line: what the list is for. */
  description?: React.ReactNode;
  /** The one primary action, e.g. "New lot". Hidden for read-only access. */
  primaryAction?: React.ReactNode;
  /** Up to two secondary actions; Export goes here. */
  secondaryActions?: React.ReactNode;
  /** An OverflowMenu with the page's remaining actions. */
  overflow?: React.ReactNode;
  Link: StaffLinkComponent;
  /** Remembers the person's columns and density for this list. */
  listKey: string;

  access?: ListPageAccess;
  /** The viewer's role, for "View only · Finance". */
  roleLabel?: string;
  /** The role that can open the page, named when access is denied. */
  requiredRole?: string;

  /** Work waiting on this list, one line each, linking to the filtered view. */
  attention?: readonly AttentionStripItem[];
  /** At most four headline numbers and the period they cover. */
  metrics?: {
    label: string;
    period: React.ReactNode;
    items: readonly Metric[];
    /** A period menu, when the period governs the numbers only and not the rows. */
    action?: React.ReactNode;
  };

  /** DataViews: built-in views as tabs, plus saved views. */
  views?: React.ReactNode;
  /** A TableSearch with `fullWidth`. */
  search?: React.ReactNode;
  /** A FilterSheet. */
  filters?: React.ReactNode;
  /** A date range that filters the rows (DateRangeFilter). */
  period?: React.ReactNode;
  /** The filters in force, as removable chips. */
  activeFilters?: readonly ActiveFilter[];
  /** Clears every filter and the search; offered by the chips and the no-results state. */
  onClearFilters?: () => void;

  table: ListPageTable<T>;
  /** "1–50 of 312" and previous/next links. */
  pagination?: {
    summary: React.ReactNode;
    prevHref: string | null;
    nextHref: string | null;
    prevLabel?: string;
  } | null;

  /** First load (skeleton rows) or a refetch (current rows dimmed). */
  loading?: boolean;
  /** True when a search or filter narrows the list; picks "no results" over "empty". */
  filtered: boolean;
  /** Loading failed. Replaces the rows, keeps the frame. */
  error?: { title?: string; description: React.ReactNode; onRetry: () => void } | null;
  /** Nothing exists yet: what will appear here and the one action that creates it. */
  empty: { title: string; description?: React.ReactNode; action?: React.ReactNode };
  /** Filters matched nothing. */
  noResults?: { title?: string; description?: React.ReactNode };
};

/**
 * The staff list page, in one fixed order so every module reads the same:
 *
 * 1. Page header: title, one line of purpose, actions (Export among the secondary ones).
 * 2. Attention strip (optional): one compact line per issue, each linking to a filtered view.
 * 3. Metric strip (optional): up to four numbers in one bordered row, with their period.
 * 4. One table surface: view tabs, then search · Filter · period · Columns · density, then the
 *    applied filters as chips, then the table (sticky header, a sort, `…` on every row), then
 *    the count and pagination.
 *
 * Loading, empty, no results, error, read-only and no access are all states of this one frame.
 */
export function ListPage<T>({
  title,
  description,
  primaryAction,
  secondaryActions,
  overflow,
  Link,
  listKey,
  access = "full",
  roleLabel,
  requiredRole,
  attention,
  metrics,
  views,
  search,
  filters,
  period,
  activeFilters = [],
  onClearFilters,
  table,
  pagination,
  loading = false,
  filtered,
  error,
  empty,
  noResults,
}: ListPageProps<T>) {
  const {
    label,
    rowActions,
    defaultHiddenColumns,
    lockedColumns,
    defaultDensity = "compact",
    columns: allColumns,
    selectedIds,
    onSelectedIdsChange,
    bulkActions,
    selectAllMatching,
    ...tableProps
  } = table;
  const readOnly = access === "read-only";
  const [density, setDensity] = useTableDensity(listKey, defaultDensity);
  const visibility = useColumnVisibility(listKey, defaultHiddenColumns);
  const locked = lockedColumns ?? (allColumns[0] ? [allColumns[0].id] : []);
  const shown = visibleColumns(allColumns, visibility.hidden, locked);
  const columns = rowActions
    ? [...shown, rowActionsColumn({ actions: rowActions.actions, label: rowActions.label, Link })]
    : shown;

  const header = (
    <PageHeader
      title={title}
      {...(description ? { description } : {})}
      {...(readOnly
        ? { status: <ViewOnlyBadge {...(roleLabel ? { role: roleLabel } : {})} /> }
        : {})}
      {...(access !== "denied" && !readOnly && primaryAction ? { primaryAction } : {})}
      {...(access !== "denied" && secondaryActions ? { secondaryActions } : {})}
      {...(access !== "denied" && overflow ? { overflow } : {})}
    />
  );

  if (access === "denied") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-staff-md border border-staff-line bg-staff-surface">
          <AccessDeniedState resource={title} {...(requiredRole ? { requiredRole } : {})} />
        </div>
      </div>
    );
  }

  const hasViewOptions = allColumns.length > 1;
  const toolbar = (
    <div className="flex flex-col">
      {views ? <div className="border-b border-staff-line-subtle px-2">{views}</div> : null}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">{search}</div>
        {filters || period ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters}
            {period}
          </div>
        ) : null}
        {hasViewOptions ? (
          <div className="hidden items-center gap-2 md:flex">
            <ColumnsMenu columns={allColumns} visibility={visibility} locked={locked} />
            <DensityToggle value={density} onChange={setDensity} />
          </div>
        ) : null}
      </div>
      {activeFilters.length > 0 ? (
        <div className="border-t border-staff-line-subtle px-3 py-2">
          <ActiveFilterChips
            filters={activeFilters}
            {...(onClearFilters ? { onClearAll: onClearFilters } : {})}
          />
        </div>
      ) : null}
    </div>
  );

  const emptyState = filtered ? (
    <NoResultsState
      title={noResults?.title ?? "Nothing matches these filters"}
      description={
        noResults?.description ?? "Try a different search, or clear the filters to see everything."
      }
      {...(onClearFilters
        ? {
            action: (
              <StaffButton size="sm" onClick={onClearFilters}>
                Clear filters
              </StaffButton>
            ),
          }
        : {})}
    />
  ) : (
    <EmptyState
      title={empty.title}
      {...(empty.description ? { description: empty.description } : {})}
      {...(empty.action && !readOnly ? { action: empty.action } : {})}
    />
  );

  const selectable = !readOnly && selectedIds && onSelectedIdsChange;

  return (
    <div className="flex flex-col gap-6">
      {header}
      {attention?.some((item) => item.count > 0) || (metrics && !error) ? (
        <div className="flex flex-col gap-4">
          {attention ? <AttentionStrip items={attention} Link={Link} /> : null}
          {metrics && !error ? (
            <MetricStrip
              label={metrics.label}
              period={metrics.period}
              items={metrics.items}
              loading={loading && metrics.items.length === 0}
              Link={Link}
              {...(metrics.action ? { action: metrics.action } : {})}
            />
          ) : null}
        </div>
      ) : null}
      <DataTable
        {...tableProps}
        label={label ?? title}
        columns={columns}
        density={density}
        loading={loading}
        {...(selectable
          ? {
              selectedIds,
              onSelectedIdsChange,
              ...(bulkActions ? { bulkActions } : {}),
              ...(selectAllMatching ? { selectAllMatching } : {}),
            }
          : {})}
        toolbar={toolbar}
        {...(error
          ? {
              error: (
                <ErrorState
                  title={error.title ?? `${title} did not load`}
                  description={error.description}
                  action={
                    <StaffButton size="sm" onClick={error.onRetry}>
                      Try again
                    </StaffButton>
                  }
                />
              ),
            }
          : {})}
        empty={emptyState}
        footer={
          pagination && !error ? (
            <TablePagination
              summary={pagination.summary}
              prevHref={pagination.prevHref}
              nextHref={pagination.nextHref}
              {...(pagination.prevLabel ? { prevLabel: pagination.prevLabel } : {})}
              Link={Link}
            />
          ) : null
        }
      />
    </div>
  );
}
