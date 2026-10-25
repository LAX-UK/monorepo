"use client";

import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { SubmissionQuickView } from "@/components/admin/submissions/submission-quick-view";
import {
  type SubmissionActionTarget,
  useSubmissionActions,
} from "@/components/admin/submissions/use-submission-actions";
import { ExportButton } from "@/components/exports/export-button";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import {
  SUBMISSIONS_DEFAULT_SORT,
  SUBMISSION_FLAG_FILTERS,
  type SubmissionsListSearch,
  type SubmissionsStaffRow,
  bulkSubmissionOperationIds,
  submissionPanelHref,
  submissionsListHref,
  submissionsSortHref,
  submissionsSortState,
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
  staffButtonVariants,
} from "@auction/staff-ui";
import { useCallback, useMemo, useState } from "react";

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
 * waiting sorting, bulk accept and reject for submissions under review, and a record panel
 * deep-linked with `?submission=`. Every row's `…` menu holds the review actions.
 */
export function SubmissionsStaffList(props: SubmissionsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const panelHref = useCallback((id: string | null) => submissionPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "submission",
    initialId:
      (typeof search.submission === "string" ? search.submission : null) ??
      (typeof search.preview === "string" ? search.preview : null),
    hrefFor: panelHref,
  });
  const actions = useSubmissionActions({ currentUserId: props.currentUserId });
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
            href={panelHref(row.id)}
            Link={panel.PanelLink}
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
        width: "140px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
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
    [panelHref, panel.PanelLink],
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
  const openRow = rows.find((row) => row.id === panel.openId) ?? null;
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
        metrics={{ label: "Submissions summary", period: "Today", items: props.metrics }}
        views={<DataViews views={props.views} activeId={props.activeQueue} Link={ListLink} />}
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
        noResults={{
          title: "No submissions match",
          description: "Try another view, or clear the search and filters.",
        }}
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
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
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
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "review", label: "Open review", href: row.href },
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
      <SubmissionQuickView
        row={openRow}
        onClose={() => panel.show(null)}
        actions={openRow ? actions.actionsFor(submissionActionTarget(openRow)) : []}
      />
      {actions.dialogs}
    </>
  );
}
