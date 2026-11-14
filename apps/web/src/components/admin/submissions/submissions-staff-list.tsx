"use client";

import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type SubmissionActionTarget,
  useSubmissionActions,
} from "@/components/admin/submissions/use-submission-actions";
import { ExportButton } from "@/components/exports/export-button";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import { listQueryOf } from "@/lib/admin/list-record";
import { createSavedViewsPort } from "@/lib/admin/saved-views-port";
import {
  SUBMISSIONS_DEFAULT_SORT,
  SUBMISSIONS_LIST_PATH,
  SUBMISSION_FLAG_FILTERS,
  type SubmissionsListSearch,
  type SubmissionsStaffRow,
  bulkSubmissionOperationIds,
  submissionsListHref,
  submissionsSortHref,
  submissionsSortState,
  submissionsTeamViews,
} from "@/lib/admin/submissions/submissions-staff-list.vm";
import {
  type AttentionStripItem,
  type DataColumn,
  DataViews,
  type EntityOption,
  FilterSheet,
  ListPage,
  type Metric,
  PrimaryCell,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
  TableSearch,
  recordHrefInList,
  staffButtonVariants,
  useSavedViews,
} from "@auction/staff-ui";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo, useState } from "react";

export type SubmissionsStaffListProps = {
  rows: SubmissionsStaffRow[];
  search: SubmissionsListSearch;
  views: StaffDataView[];
  activeQueue: string;
  attention: AttentionStripItem[];
  metrics: Metric[];
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  categories: EntityOption[];
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  currentUserId: string;
  exportFilters: Record<string, unknown>;
  listError: string | null;
  /** What the action that sent staff here has to say, shown under the header. */
  notice?: ReactNode;
  filtered: boolean;
};

export function submissionActionTarget(row: SubmissionsStaffRow): SubmissionActionTarget {
  return {
    id: row.id,
    title: row.title,
    status: row.statusCode,
    blocksAccept: row.blocksAccept,
    assignedToMe: row.assignedToMe,
    decisionHref: row.decisionHref,
  };
}

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  awaiting: {
    title: "Nothing awaiting a decision",
    description: "New seller submissions appear here as soon as they are sent.",
  },
  accepted: {
    title: "No accepted submissions",
    description: "Submissions accepted for cataloguing appear here until their lot is created.",
  },
  rejected: {
    title: "No rejected submissions",
    description: "Submissions you reject appear here with the reason the seller was given.",
  },
};

/**
 * Seller submissions on the staff list template: the decision queues as views with counts,
 * search, a filter sheet for category and the desk's own flags, oldest-
 * waiting sorting, and bulk accept and reject for submissions under review. A row opens the
 * submission's review page, which keeps this list's query for Previous and Next; Back returns to
 * the list as it was. Every row's `…` menu holds the review actions.
 */
export function SubmissionsStaffList(props: SubmissionsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listQuery = useMemo(() => listQueryOf(search, ["submission", "preview"]), [search]);
  const recordHref = useCallback(
    (row: SubmissionsStaffRow) => recordHrefInList(row.href, listQuery),
    [listQuery],
  );
  const actions = useSubmissionActions({ currentUserId: props.currentUserId });
  const port = useMemo(() => createSavedViewsPort("bid-admin.submissions"), []);
  const saved = useSavedViews("bid-admin.submissions", port);
  const teamViews = useMemo(() => submissionsTeamViews(), []);
  const currentQuery = submissionsListHref(search, {}).split("?")[1] ?? "";
  const q = typeof search.q === "string" ? search.q : "";
  const categoryId = typeof search.categoryId === "string" ? search.categoryId : "";
  const flags = [
    ...(search.assignedTo === "me" ? ["assignedToMe"] : []),
    ...(search.qualityGaps === "1" ? ["qualityGaps"] : []),
  ];
  const allOperations = useMemo(() => getSubmissionBulkOperations(), []);

  const columns = useMemo<DataColumn<SubmissionsStaffRow>[]>(
    () => [
      {
        id: "submission",
        header: "Submission",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={recordHref(row)}
            Link={Link}
            thumbnail={{ src: row.thumbnailUrl, missingLabel: "No photos" }}
            secondary={row.category}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "180px",
        // On a phone the status sits on the line under the title, so a longer status such as
        // "Waiting for the seller" never squeezes the title.
        mobile: "meta",
        truncate: false,
        // Accepted work shows what it waits on, which says more than "Approved".
        cell: (row) => {
          const status = row.sellerWait ?? row.status;
          return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
        },
      },
      {
        id: "seller",
        header: "Seller",
        width: "18%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => row.seller,
      },
      {
        id: "waiting",
        header: "Waiting",
        width: "140px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) =>
          row.waiting ? (
            <StatusBadge tone={row.waiting.tone}>{row.waiting.label}</StatusBadge>
          ) : null,
      },
      {
        id: "quality",
        header: "Details",
        width: "180px",
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) =>
          row.quality ? (
            <StatusBadge tone={row.quality.tone}>{row.quality.label}</StatusBadge>
          ) : null,
      },
      {
        id: "assignee",
        header: "Assigned to",
        width: "140px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => row.assignee,
      },
      {
        id: "submitted",
        header: "Submitted",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.submittedAt} />,
      },
    ],
    [recordHref],
  );

  const activeFilters = props.filterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const clearHref = submissionsListHref(search, {
    q: null,
    categoryId: null,
    assignedTo: null,
    qualityGaps: null,
    sort: null,
  });
  const empty = EMPTY_COPY[props.activeQueue] ?? EMPTY_COPY.awaiting;

  return (
    <>
      <ListPage<SubmissionsStaffRow>
        title="Submissions"
        description="Review what sellers send in: accept it for cataloguing or reject it with a reason."
        Link={ListLink}
        listKey="bid-admin.submissions"
        exportAction={
          <ExportButton
            entityType="submissions"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        attention={props.attention}
        metrics={{ label: "Submissions summary", period: "Review desk", items: props.metrics }}
        views={
          <DataViews
            views={props.views}
            activeId={props.activeQueue}
            Link={ListLink}
            team={teamViews}
            saved={saved}
            savedHref={(view) => `${SUBMISSIONS_LIST_PATH}?${view.query}`}
            currentQuery={currentQuery}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search submissions"
            placeholder="Search by title or seller"
            value={q}
            onSearch={(next) => navigate(submissionsListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter submissions"
            sections={[
              {
                kind: "entity",
                id: "categoryId",
                label: "Category",
                value: categoryId,
                options: props.categories,
                placeholder: "Any category",
                searchPlaceholder: "Search categories",
                emptyText: "No categories match.",
              },
              {
                kind: "checklist",
                id: "flags",
                label: "Show only",
                options: SUBMISSION_FLAG_FILTERS,
                value: flags,
              },
            ]}
            onApply={(values) => {
              const chosen = (values.flags as readonly string[] | undefined) ?? [];
              navigate(
                submissionsListHref(search, {
                  categoryId: (values.categoryId as string) || null,
                  assignedTo: chosen.includes("assignedToMe") ? "me" : null,
                  qualityGaps: chosen.includes("qualityGaps") ? "1" : null,
                }),
              );
            }}
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(clearHref)}
        loading={pending}
        notice={props.notice}
        filtered={filtered}
        error={
          props.listError
            ? {
                description: props.listError,
                onRetry: () => navigate(submissionsListHref(search, {})),
              }
            : null
        }
        empty={empty ?? { title: "No submissions" }}
        noResults={{ noun: "submissions" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The submission cell has a photo and a second line, which need 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["assignee"],
          defaultSort: SUBMISSIONS_DEFAULT_SORT,
          sort: submissionsSortState(typeof search.sort === "string" ? search.sort : undefined),
          onSortChange: (sort) => navigate(submissionsSortHref(search, sort)),
          rowHref: recordHref,
          selectedIds: selected,
          onSelectedIdsChange: setSelected,
          bulkNoun: { one: "submission", other: "submissions" },
          bulkActions: (chosen: SubmissionsStaffRow[]) => {
            const allowed = bulkSubmissionOperationIds(chosen);
            return (
              <StaffBulkOperations
                operations={allOperations.filter((operation) =>
                  (allowed as readonly string[]).includes(operation.id),
                )}
                selectedIds={chosen.map((row) => row.id)}
                onClear={() => setSelected(new Set())}
                noun={{ one: "submission", other: "submissions" }}
              />
            );
          },
          rowActions: {
            label: (row) => `Actions for submission ${row.title}`,
            actions: (row) => [
              { id: "review", label: "Open review", href: recordHref(row) },
              ...actions.actionsFor(submissionActionTarget(row)),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(submissionsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      {actions.dialogs}
    </>
  );
}
