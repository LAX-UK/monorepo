"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type FailedJobsFilterChip,
  type FailedJobsFilters,
  type FailedJobsSearch,
  failedJobHref,
  failedJobsHref,
} from "@/lib/admin/failed-jobs/failed-jobs-search";
import {
  FAILED_JOBS_EMPTY,
  FAILED_JOB_STATE_BADGE,
  failedJobsViewTabs,
} from "@/lib/admin/failed-jobs/failed-jobs.vm";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  Notice,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import type { FailedJobList, FailedJobSummary } from "@auction/types";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ACTIONS_OFF_COPY } from "./failed-job-copy";
import { useFailedJobActions } from "./use-failed-job-actions";

export type FailedJobsListProps = {
  list: FailedJobList | null;
  search: FailedJobsSearch;
  filters: FailedJobsFilters;
  chips: FailedJobsFilterChip[];
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  /** A search or filter narrows the list (the view tab alone does not). */
  filtered: boolean;
  /** The person may retry, discard and restore; otherwise the list is view only. */
  canAct: boolean;
};

/**
 * Failed background jobs on the staff list template: a tab per stage (needs review, retried,
 * discarded) with counts, search, a filter for the kind of job and the day it last failed, the
 * newest failure first, and a job page behind every row. Administrators can retry or discard
 * one job from its menu or a selection from the bulk bar; read-only staff see the same rows
 * with no checkboxes and no actions. A retry the job's type or an operator's switch blocks stays
 * in the menu, disabled with the reason.
 */
export function FailedJobsList(props: FailedJobsListProps) {
  const { list, search, filters, canAct } = props;
  const rows = list?.rows ?? [];
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actions = useFailedJobActions();
  const tabs = list ? failedJobsViewTabs(list.counts) : [];

  const actionsFor = useCallback(
    (row: FailedJobSummary): OverflowAction[] => {
      const open: OverflowAction = { id: "open", label: "Open job", href: failedJobHref(row.id) };
      const copy: OverflowAction = {
        id: "copy",
        label: "Copy job ID",
        onSelect: () => copyToClipboard(row.id, "Job ID"),
      };
      if (!canAct) return [open, copy];
      if (row.state === "discarded") {
        return [
          open,
          { id: "restore", label: "Restore", onSelect: () => actions.restore([row.id]) },
          copy,
        ];
      }
      return [
        open,
        {
          id: "retry",
          label: "Retry",
          onSelect: () => actions.retry([row]),
          ...(row.retry.allowed ? {} : { disabledReason: row.retry.reason }),
        },
        copy,
        ...(row.state === "needs_review"
          ? [
              {
                id: "discard",
                label: "Discard…",
                tone: "danger" as const,
                onSelect: () => actions.discard([row]),
              },
            ]
          : []),
      ];
    },
    [actions, canAct],
  );

  const columns = useMemo<DataColumn<FailedJobSummary>[]>(
    () => [
      {
        id: "job",
        header: "Job",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={failedJobHref(row.id)}
            Link={Link}
            secondary={[row.sourceLabel, row.jobLabel].filter(Boolean).join(" · ")}
          >
            {row.typeLabel}
          </PrimaryCell>
        ),
      },
      {
        id: "error",
        header: "Error",
        width: "34%",
        mobile: "meta",
        cell: (row) => (
          <span className="font-mono text-staff-xs text-staff-fg">{row.errorSummary}</span>
        ),
      },
      {
        id: "attempts",
        header: "Attempts",
        width: "88px",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <span className="tabular-nums">{row.attempts}</span>,
      },
      {
        id: "first",
        header: "First failed",
        width: "176px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.firstFailedAt} withTime />,
      },
      {
        id: "last",
        header: "Last failed",
        width: "176px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.lastFailedAt} withTime />,
      },
      ...(filters.view === "needs_review"
        ? []
        : [
            {
              id: "state",
              header: "Status",
              width: "120px",
              mobile: "badge" as const,
              truncate: false as const,
              cell: (row: FailedJobSummary) => (
                <StatusBadge tone={FAILED_JOB_STATE_BADGE[row.state].tone}>
                  {FAILED_JOB_STATE_BADGE[row.state].label}
                </StatusBadge>
              ),
            },
          ]),
    ],
    [filters.view],
  );

  const bulkActions = (chosen: FailedJobSummary[]) => (
    <>
      {filters.view === "discarded" ? (
        <StaffButton
          size="sm"
          onClick={() => {
            actions.restore(chosen.map((row) => row.id));
            setSelected(new Set());
          }}
        >
          Restore
        </StaffButton>
      ) : (
        <>
          <StaffButton
            size="sm"
            disabled={filters.view !== "needs_review" || chosen.every((row) => !row.retry.allowed)}
            onClick={() => actions.retry(chosen)}
          >
            Retry
          </StaffButton>
          <StaffButton
            size="sm"
            disabled={filters.view !== "needs_review"}
            onClick={() => actions.discard(chosen)}
          >
            Discard…
          </StaffButton>
        </>
      )}
    </>
  );

  return (
    <>
      <ListPage<FailedJobSummary>
        title="Failed jobs"
        description="Background jobs that ran out of attempts. Retry them once the cause is fixed, or discard them with a reason."
        Link={ListLink}
        listKey="bid-admin.failed-jobs"
        access={canAct ? "full" : "read-only"}
        {...(list && !list.actionsEnabled
          ? {
              notice: (
                <Notice tone="warning" title={ACTIONS_OFF_COPY.title}>
                  {ACTIONS_OFF_COPY.body}
                </Notice>
              ),
            }
          : {})}
        views={
          <DataViews
            views={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: failedJobsHref(search, { view: tab.id }),
              count: tab.count,
            }))}
            activeId={filters.view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={filters.q}
            fullWidth
            label="Search failed jobs"
            placeholder="Search job type, error or job ID"
            value={filters.q}
            onSearch={(q) => navigate(failedJobsHref(search, { q: q || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter failed jobs"
            sections={[
              {
                kind: "radio",
                id: "queue",
                label: "Job type",
                value: filters.queue,
                anyLabel: "Any type",
                options: (list?.queues ?? []).map((queue) => ({
                  value: queue.id,
                  label: queue.label,
                  count: queue.count,
                })),
              },
              {
                kind: "date-range",
                id: "date",
                label: "Last failed",
                value: { from: filters.from, to: filters.to },
              },
            ]}
            onApply={(values) => {
              const date = values.date as { from: string; to: string };
              navigate(
                failedJobsHref(search, {
                  queue: (values.queue as string) || null,
                  from: date.from || null,
                  to: date.to || null,
                }),
              );
            }}
          />
        }
        activeFilters={props.chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() =>
          navigate(failedJobsHref(search, { q: null, queue: null, from: null, to: null }))
        }
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: "Failed jobs couldn't be loaded",
                description: props.loadError,
                onRetry: () => navigate(failedJobsHref(search, {})),
              }
            : null
        }
        empty={FAILED_JOBS_EMPTY[filters.view]}
        noResults={{ noun: "failed jobs" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultSort: { columnId: "last", direction: "desc" },
          sort: { columnId: "last", direction: filters.sort === "failed_asc" ? "asc" : "desc" },
          onSortChange: (sort) =>
            navigate(
              failedJobsHref(search, {
                sort: sort.direction === "asc" ? "failed_asc" : "failed_desc",
              }),
            ),
          onRowOpen: (row) => navigate(failedJobHref(row.id)),
          selectedIds: selected,
          onSelectedIdsChange: setSelected,
          bulkNoun: { one: "job", other: "jobs" },
          bulkActions,
          rowActions: {
            label: (row) => `Actions for ${row.typeLabel}, ${row.errorSummary}`,
            actions: actionsFor,
          },
        }}
        pagination={props.pagination}
      />
      {actions.dialogs}
    </>
  );
}
