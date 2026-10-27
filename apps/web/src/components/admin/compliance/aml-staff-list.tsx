"use client";

import { useAmlDecisionActions } from "@/components/admin/compliance/aml-decision-actions";
import { AmlQuickView } from "@/components/admin/compliance/aml-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type AmlCapabilities,
  type AmlListSearch,
  type AmlStaffRow,
  amlAttention,
  amlListHref,
  amlMetrics,
} from "@/lib/admin/compliance/aml-staff-list.vm";
import type { AdminAmlListSummary } from "@/lib/data/http/compliance-aml.shared";
import { type DataColumn, ListPage, PrimaryCell, StaffDate, StatusBadge } from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";

const COUNT = new Intl.NumberFormat("en-GB");

export type AmlStaffListProps = {
  search: AmlListSearch;
  rows: AmlStaffRow[];
  /** The screening named by `?screening=` when it is not on this page. */
  selected: AmlStaffRow | null;
  selectedId: string | null;
  summary: AdminAmlListSummary;
  capabilities: AmlCapabilities;
  attentionCounts: { manualReviewCount: number; sourceOfFundsPending: number };
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's AML screening queue on the staff list template: the pending watchlist matches, with the
 * two-stage maker-checker in each row's `…` menu and the record panel. An analyst records a
 * triage recommendation; a different MLRO then clears or blocks. Every decision opens a confirm
 * dialog naming the client.
 */
export function AmlStaffList(props: AmlStaffListProps) {
  const { search, rows, capabilities } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(props.selectedId);
  const aml = useAmlDecisionActions(capabilities);

  const columns = useMemo<DataColumn<AmlStaffRow>[]>(
    () => [
      {
        id: "client",
        header: "Client",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={`/admin/clients/${encodeURIComponent(row.userId)}`}
            Link={Link}
            secondary={row.categories}
          >
            {row.client}
          </PrimaryCell>
        ),
      },
      {
        id: "match",
        header: "Match",
        width: "148px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.match.tone}>{row.match.label}</StatusBadge>,
      },
      {
        id: "policy",
        header: "Policy outcome",
        width: "168px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.decision.tone}>{row.decision.label}</StatusBadge>,
      },
      {
        id: "triage",
        header: "Triage",
        width: "168px",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => row.triage.label,
      },
      {
        id: "hits",
        header: "Hits",
        width: "88px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.totalHits,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.totalHits,
      },
      {
        id: "screened",
        header: "Screened",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.screenedAt,
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.screenedAt} />,
      },
    ],
    [],
  );

  const openRow =
    rows.find((row) => row.id === openId) ??
    (props.selected && props.selected.id === openId ? props.selected : null);

  return (
    <>
      <ListPage<AmlStaffRow>
        title="AML screening"
        description="Watchlist matches awaiting review. An analyst recommends a clear or a block, then a different MLRO decides; clearing lifts the settlement hold."
        Link={ListLink}
        listKey="bid-admin.compliance-aml"
        attention={amlAttention(props.attentionCounts)}
        metrics={{
          label: "AML screening summary",
          period: "Pending screenings, all pages",
          items: amlMetrics(props.summary),
        }}
        loading={pending}
        filtered={false}
        noResults={{ noun: "screenings" }}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(amlListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No pending AML screenings",
          description:
            "Watchlist matches awaiting triage appear here. Escalations are also emailed to compliance officers.",
        }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultSort: { columnId: "screened", direction: "asc" },
          onRowOpen: (row) => setOpenId(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for screening ${row.client}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => setOpenId(row.id) },
              {
                id: "client",
                label: "Open client",
                href: `/admin/clients/${encodeURIComponent(row.userId)}`,
              },
              ...aml.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(amlListHref(search, { limit: size })),
        }}
        resultCount={`${COUNT.format(props.summary.total)} ${props.summary.total === 1 ? "screening" : "screenings"}`}
        pagination={props.pagination}
      />
      <AmlQuickView
        row={openRow}
        capabilities={capabilities}
        onClose={() => setOpenId(null)}
        onTriage={aml.triage}
        onDecide={aml.decide}
        decisionActions={openRow ? aml.actionsFor(openRow) : []}
      />
      {aml.dialogs}
    </>
  );
}
