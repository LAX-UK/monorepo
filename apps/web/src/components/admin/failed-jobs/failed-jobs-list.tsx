"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { type FailedJobGroup, groupFailedJobs } from "@/lib/admin/failed-jobs/failed-job-groups";
import {
  type FailedJobsFilterChip,
  type FailedJobsFilters,
  type FailedJobsSearch,
  failedJobHref,
  failedJobsHref,
} from "@/lib/admin/failed-jobs/failed-jobs-search";
import {
  FAILED_JOB_STATE_BADGE,
  failedJobsEmpty,
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
import type { FailedJobList } from "@auction/types";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ACTIONS_OFF_COPY, FAILED_JOBS_DESCRIPTION } from "./failed-job-copy";
import { GroupCount } from "./group-count";
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
  const groups = useMemo(() => groupFailedJobs(list?.rows ?? []), [list]);
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actions = useFailedJobActions();
  const tabs = list ? failedJobsViewTabs(list.counts) : [];
  // A person who can only see one kind of failure (Finance) gets that kind's wording.
  const onlySource = list?.sources.length === 1 ? (list.sources[0]?.id ?? "") : "";

  const actionsFor = useCallback(
    (row: FailedJobGroup): OverflowAction[] => {
      const open: OverflowAction = { id: "open", label: "Open job", href: failedJobHref(row.id) };
      const copy: OverflowAction = {
        id: "copy",
        label: row.members.length > 1 ? `Copy ${row.members.length} job IDs` : "Copy job ID",
        onSelect: () =>
          copyToClipboard(row.members.map((member) => member.id).join("\n"), "Job ID"),
      };
      if (!canAct || !row.canAct) return [open, copy];
      if (row.state === "discarded") {
        return [
          open,
          {
            id: "restore",
            label: "Restore",
            onSelect: () => actions.restore(row.members.map((member) => member.id)),
          },
          copy,
        ];
      }
      return [
        open,
        {
          id: "retry",
          label: "Retry",
          onSelect: () => actions.retry(row.members),
          ...(row.retry.allowed ? {} : { disabledReason: row.retry.reason }),
        },
        copy,
        ...(row.state === "needs_review"
          ? [
              {
                id: "discard",
                label: "Discard…",
                tone: "danger" as const,
                onSelect: () => actions.discard(row.members),
              },
            ]
          : []),
      ];
    },
    [actions, canAct],
  );

  const columns = useMemo<DataColumn<FailedJobGroup>[]>(
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
            {row.members.length > 1 ? <GroupCount count={row.members.length} /> : null}
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
              cell: (row: FailedJobGroup) => (
                <StatusBadge tone={FAILED_JOB_STATE_BADGE[row.state].tone}>
                  {FAILED_JOB_STATE_BADGE[row.state].label}
                </StatusBadge>
              ),
            },
          ]),
    ],
    [filters.view],
  );

  const bulkActions = (chosen: FailedJobGroup[]) => (
    <>
      {filters.view === "discarded" ? (
        <StaffButton
          size="sm"
          onClick={() => {
            actions.restore(chosen.flatMap((row) => row.members.map((member) => member.id)));
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
            onClick={() => actions.retry(chosen.flatMap((row) => row.members))}
          >
            Retry
          </StaffButton>
          <StaffButton
            size="sm"
            disabled={filters.view !== "needs_review"}
            onClick={() => actions.discard(chosen.flatMap((row) => row.members))}
          >
            Discard…
          </StaffButton>
        </>
      )}
    </>
  );

  return (
    <>
      <ListPage<FailedJobGroup>
        title="Failed jobs"
        description={FAILED_JOBS_DESCRIPTION}
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
            placeholder="Search type, error or ID"
            value={filters.q}
            onSearch={(q) => navigate(failedJobsHref(search, { q: q || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter failed jobs"
            sections={[
              ...((list?.sources.length ?? 0) > 1
                ? [
                    {
                      kind: "radio" as const,
                      id: "source",
                      label: "Source",
                      value: filters.source,
                      anyLabel: "All sources",
                      options: (list?.sources ?? []).map((source) => ({
                        value: source.id,
                        label: source.label,
                        count: source.count,
                      })),
                    },
                  ]
                : []),
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
                  source: (values.source as string | undefined) || null,
                  queue: (values.queue as string) || null,
                  from: date.from || null,
                  to: date.to || null,
                }),
              );
            }}
          />
        }
        activeFilters={[
          ...(list?.limitedTo
            ? [{ id: "limit", label: `Source: ${list.limitedTo}`, locked: true as const }]
            : []),
          ...props.chips.map((chip) => ({
            id: chip.id,
            label: chip.label,
            onRemove: () => navigate(chip.clearHref),
          })),
        ]}
        onClearFilters={() =>
          navigate(
            failedJobsHref(search, { q: null, source: null, queue: null, from: null, to: null }),
          )
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
        empty={{
          ...failedJobsEmpty(filters.view, filters.source || onlySource),
          ...(filters.source
            ? {
                action: (
                  <StaffButton
                    variant="secondary"
                    onClick={() => navigate(failedJobsHref(search, { source: null }))}
                  >
                    Clear Source filter
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "failed jobs" }}
        table={{
          columns,
          data: groups,
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
