"use client";

import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import type { LinkComponent } from "@auction/ui/lax";
import type * as React from "react";
import { type StaffPermission, useStaffPageAccess } from "../access/staff-access.js";
import { useColumnVisibility, visibleColumns } from "../data/columns-menu.js";
import { DataTable, type DataTableProps } from "../data/data-table.js";
import { DisplayMenu, type DisplayPageSize } from "../data/display-menu.js";
import { rowActionsColumn } from "../data/row-actions.js";
import {
  type ActiveFilter,
  ActiveFilterChips,
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
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import type { OverflowAction } from "../shell/overflow-menu.js";
import { PageHeader } from "../shell/page-header.js";

/** One sentence for every list whose search or filters matched nothing. */
export const NO_RESULTS_DESCRIPTION =
  "Try a different search or filter, or clear the filters to start again.";

/** "No payments match". */
export const noResultsTitle = (noun: string) => `No ${noun} match`;

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
  /** Columns that start hidden; the person can show them from "Display". */
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
  /** Up to two secondary actions besides Export. */
  secondaryActions?: React.ReactNode;
  /**
   * Export of what the list shows: an export control built from the same query as the rows (the
   * view, search and every filter, without the page), so the file always matches the list. Sits
   * first among the header's secondary actions.
   */
  exportAction?: React.ReactNode;
  /** An OverflowMenu with the page's remaining actions. */
  overflow?: React.ReactNode;
  Link: LinkComponent;
  /** Remembers the person's columns and density for this list. */
  listKey: string;

  access?: ListPageAccess;
  /**
   * What changing the list's records needs. Without an explicit `access`, the list is read-only
   * for people who lack it: no primary action, "View only" with their roles in the header.
   */
  editRequires?: StaffPermission;
  /** The viewer's role, for "View only · Finance"; defaults to the roles the kit was given. */
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
  /**
   * How many records the list holds, "12 screenings". Shown at the left of the slim row that
   * carries "Display" when the list has no view tabs, search or filters.
   */
  resultCount?: React.ReactNode;
  /** Rows per page (25, 50 or 100; 50 by default), offered in "Display". */
  pageSize?: DisplayPageSize | null;
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
  empty: {
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    /** The drawing that matches the list: "parcel" for orders, "ledger" for money. */
    illustration?: LaxIllustrationName;
  };
  /**
   * Filters matched nothing. Say what the list holds, in the plural ("payments"); the title,
   * the sentence and "Clear filters" are the same on every list.
   */
  noResults: { noun: string };
};

/**
 * The staff list page, in one fixed order so every module reads the same:
 *
 * 1. Page header: title, one line of purpose, actions (Export among the secondary ones).
 * 2. Attention strip (optional): one compact line per issue, each linking to a filtered view.
 * 3. Metric strip (optional): up to four numbers in one bordered row, with their period.
 * 4. One table surface: view tabs, then search · Filter · period · Display, then the applied
 *    filters as chips (all of it sticking under the top bar), then the table (sticky header, a
 *    sort, `…` on every row), then the count and pagination.
 *
 * The four blocks sit 24px apart and share one surface: radius md, a hairline border and the
 * surface fill.
 *
 * Loading, empty, no results, error, read-only and no access are all states of this one frame.
 */
export function ListPage<T>({
  title,
  description,
  primaryAction,
  secondaryActions,
  exportAction,
  overflow,
  Link,
  listKey,
  access: accessProp,
  editRequires,
  roleLabel: roleLabelProp,
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
  resultCount,
  pageSize,
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
  const page = useStaffPageAccess(accessProp, editRequires);
  const access = page.access;
  const roleLabel = roleLabelProp ?? page.roleLabel;
  const readOnly = access === "read-only";
  // An empty list offers the action that creates it in its empty state; the header does not
  // repeat it. The header action returns as soon as there is a row, a filter or an error.
  const emptyOffersAction =
    !loading &&
    !error &&
    !filtered &&
    table.data.length === 0 &&
    Boolean(empty.action) &&
    !readOnly;
  const [density, setDensity] = useTableDensity(listKey, defaultDensity);
  const headerSecondary =
    exportAction || secondaryActions ? (
      <>
        {exportAction}
        {secondaryActions}
      </>
    ) : null;
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
      {...(access !== "denied" &&
      (accessProp === undefined || !readOnly) &&
      !emptyOffersAction &&
      primaryAction
        ? { primaryAction }
        : {})}
      {...(access !== "denied" && headerSecondary ? { secondaryActions: headerSecondary } : {})}
      {...(access !== "denied" && overflow ? { overflow } : {})}
    />
  );

  if (access === "denied") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
          <AccessDeniedState resource={title} {...(requiredRole ? { requiredRole } : {})} />
        </div>
      </div>
    );
  }

  const hasViewOptions = allColumns.length > 1 || Boolean(pageSize);
  const display = hasViewOptions ? (
    <DisplayMenu
      columns={allColumns}
      visibility={visibility}
      locked={locked}
      density={density}
      onDensityChange={setDensity}
      defaultDensity={defaultDensity}
      {...(pageSize ? { pageSize } : {})}
    />
  ) : null;
  // The search is the only thing that needs a row of its own. Without it, the controls (Filter,
  // period, Display) join the view tabs, or sit in a slim row beside the record count; no band
  // is ever left holding a control or two and empty space.
  const controls =
    filters || period || display ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {filters}
        {period}
        {display}
      </div>
    ) : null;
  const toolbar = (
    <div className="flex flex-col">
      {views ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 px-2",
            search && "border-b border-staff-line-subtle",
          )}
        >
          <div className="min-w-0 flex-1">{views}</div>
          {!search && controls ? <div className="py-1 pr-1">{controls}</div> : null}
        </div>
      ) : null}
      {search ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">{search}</div>
          {controls}
        </div>
      ) : !views && (controls || resultCount) ? (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-1.5 pr-3 pl-4">
          <p className="text-staff-sm text-staff-muted tabular-nums">{resultCount}</p>
          {controls}
        </div>
      ) : null}
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
      title={noResultsTitle(noResults.noun)}
      description={NO_RESULTS_DESCRIPTION}
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
      {...(empty.illustration ? { illustration: empty.illustration } : {})}
      {...(empty.description ? { description: empty.description } : {})}
      {...(empty.action && !readOnly ? { action: empty.action } : {})}
    />
  );

  const selectable = !readOnly && selectedIds && onSelectedIdsChange;

  return (
    <div className="flex flex-col gap-6">
      {header}
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
          pagination && !error && !(filtered && table.data.length === 0) ? (
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
