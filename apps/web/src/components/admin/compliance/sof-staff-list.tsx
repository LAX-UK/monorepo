"use client";

import { useSofReopenAction } from "@/components/admin/compliance/sof-reopen-action";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  SOF_VIEW_LABELS,
  type SofListSearch,
  type SofStaffRow,
  sofAttention,
  sofEmptyCopy,
  sofListHref,
  sofMetrics,
  sofViews,
} from "@/lib/admin/compliance/sof-staff-list.vm";
import type { SofListStatus } from "@/lib/admin/sof-list-query";
import type { AdminSourceOfFundsListSummary } from "@/lib/data/http/compliance-sof.shared";
import {
  type DataColumn,
  DataViews,
  ListPage,
  PrimaryCell,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo } from "react";

export type SofStaffListProps = {
  search: SofListSearch;
  status: SofListStatus;
  rows: SofStaffRow[];
  summary: AdminSourceOfFundsListSummary;
  canReopen: boolean;
  attentionCounts: { manualReviewCount: number; amlScreeningsPending: number };
  pendingCount: number;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's source of funds cases on the staff list template: pending, rejected and approved as tabs,
 * each row opening its case page, where the evidence is reviewed and the two-stage decision made.
 * A rejected case is reopened from the row's `…` menu, through a confirm dialog that names the buyer.
 */
export function SofStaffList(props: SofStaffListProps) {
  const { search, rows, status } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const reopen = useSofReopenAction({ canReopen: props.canReopen });
  const isPending = status === "pending";

  const columns = useMemo<DataColumn<SofStaffRow>[]>(
    () => [
      {
        id: "buyer",
        header: "Buyer",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={row.href}
            Link={Link}
            secondary={
              row.otherOpenCases > 0
                ? `${row.settlement ?? "No settlement"} · ${row.otherOpenCases} other open ${
                    row.otherOpenCases === 1 ? "case" : "cases"
                  }`
                : row.settlement
            }
          >
            {row.buyer}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "184px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "trigger",
        header: "Trigger",
        width: "20%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.trigger,
      },
      {
        id: "exposure",
        header: "Exposure",
        width: "136px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.exposurePence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.exposure,
      },
      ...(isPending
        ? ([
            {
              id: "evidence",
              header: "Evidence",
              width: "96px",
              numeric: true,
              hideBelow: "xl",
              mobile: "hidden",
              cell: (row) => row.evidenceCount,
            },
            {
              id: "triage",
              header: "Triage",
              width: "160px",
              hideBelow: "lg",
              mobile: "meta",
              cell: (row) => row.triage,
            },
            {
              id: "opened",
              header: "Opened",
              width: "120px",
              sortable: true,
              sortValue: (row) => row.createdAt,
              defaultSortDirection: "asc",
              hideBelow: "md",
              mobile: "meta",
              truncate: false,
              cell: (row) => <StaffDate value={row.createdAt} />,
            },
          ] satisfies DataColumn<SofStaffRow>[])
        : ([
            {
              id: "reviewed",
              header: "Reviewed",
              width: "120px",
              sortable: true,
              sortValue: (row) => row.reviewedAt,
              defaultSortDirection: "desc",
              hideBelow: "md",
              mobile: "meta",
              truncate: false,
              cell: (row) => <StaffDate value={row.reviewedAt} />,
            },
          ] satisfies DataColumn<SofStaffRow>[])),
    ],
    [isPending],
  );

  const empty = sofEmptyCopy(status);

  return (
    <>
      <ListPage<SofStaffRow>
        title="Source of funds"
        description="Settlement is blocked until a pending case is approved by an MLRO, after an analyst's triage. A rejected case keeps blocking until it is reopened."
        Link={ListLink}
        listKey="bid-admin.compliance-source-of-funds"
        attention={sofAttention(props.attentionCounts)}
        metrics={{
          label: "Source of funds summary",
          period: `${SOF_VIEW_LABELS[status]} cases, all pages`,
          items: sofMetrics(status, props.summary),
        }}
        views={
          <DataViews
            views={sofViews(search, props.pendingCount)}
            activeId={status}
            Link={ListLink}
          />
        }
        loading={pending}
        filtered={false}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(sofListHref(search, {})),
              }
            : null
        }
        empty={empty}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultSort: isPending
            ? { columnId: "opened", direction: "asc" }
            : { columnId: "reviewed", direction: "desc" },
          onRowOpen: (row) => navigate(row.href),
          rowActions: {
            label: (row) => `Actions for case ${row.buyer}`,
            actions: (row) => [
              { id: "open", label: "Open case", href: row.href },
              {
                id: "client",
                label: "Open client profile",
                href: `/admin/clients/${encodeURIComponent(row.userId)}`,
              },
              ...reopen.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(sofListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      {reopen.dialogs}
    </>
  );
}
