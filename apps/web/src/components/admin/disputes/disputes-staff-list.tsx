"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { disputeCaseHref, disputeStripeHref } from "@/lib/admin/finance/dispute-links";
import {
  DISPUTE_REASON_FILTERS,
  type DisputesListSearch,
  type DisputesStaffRow,
  EMPTY_VIEW_COPY,
  disputesFilterChips,
  disputesListHref,
  disputesViews,
} from "@/lib/admin/finance/disputes-staff-list.vm";
import { notify } from "@/lib/ui/notify";
import {
  CellLink,
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PrimaryCell,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import type { DisputeDeskCounts, DisputeDeskView } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

export type DisputesStaffListProps = {
  search: DisputesListSearch;
  view: DisputeDeskView;
  rows: DisputesStaffRow[];
  counts: DisputeDeskCounts;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  filtered: boolean;
  loadError: string | null;
  /** Buyer pages need their own capability; without it names show as plain text. */
  canOpenClient: boolean;
};

const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

/**
 * Bid's card disputes on the staff list template: one tab per queue (cases to allocate, open,
 * under review, closed), the soonest respond-by first, and a case page for each row. A deadline
 * within a week is a badge with its days left, so it reads without colour.
 */
export function DisputesStaffList(props: DisputesStaffListProps) {
  const { search, rows, view, canOpenClient } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const q = typeof search.q === "string" ? search.q : "";
  const reason = typeof search.reason === "string" ? search.reason : "";

  const columns = useMemo<DataColumn<DisputesStaffRow>[]>(
    () => [
      {
        id: "case",
        header: "Dispute",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={disputeCaseHref(row.id)} Link={Link} secondary={row.reason}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "allocation",
        header: "Allocation",
        width: "152px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.allocation.tone}>{row.allocation.label}</StatusBadge>,
      },
      {
        id: "deadline",
        header: "Respond by",
        width: "152px",
        sortable: true,
        sortValue: (row) => (row.dueBy ? Date.parse(row.dueBy) : FAR_FUTURE),
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) =>
          row.deadline ? (
            row.deadline.tone ? (
              <StatusBadge tone={row.deadline.tone}>{row.deadline.label}</StatusBadge>
            ) : (
              <span className="text-staff-muted">{row.deadline.label}</span>
            )
          ) : null,
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "18%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.buyerId && row.buyer ? (
            canOpenClient ? (
              <CellLink href={`/admin/clients/${encodeURIComponent(row.buyerId)}`} Link={Link}>
                {row.buyer}
              </CellLink>
            ) : (
              row.buyer
            )
          ) : (
            <span className="text-staff-muted">Unknown buyer</span>
          ),
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.amountPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.amount,
      },
      {
        id: "status",
        header: "Status",
        width: "136px",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "opened",
        header: "Opened",
        width: "120px",
        sortable: true,
        sortValue: (row) => Date.parse(row.openedAt),
        defaultSortDirection: "desc",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.openedAt} />,
      },
    ],
    [canOpenClient],
  );

  const chips = disputesFilterChips(search).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const copy = EMPTY_VIEW_COPY[view];
  const emptyAction =
    view === "needs_allocation" || view === "open" ? (
      <Link
        href={disputesListHref(search, { view: "closed", q: null, reason: null })}
        className="staff-focus rounded-staff-xs text-staff-sm font-medium text-staff-fg underline underline-offset-2"
      >
        View closed cases
      </Link>
    ) : undefined;

  return (
    <ListPage<DisputesStaffRow>
      title="Disputes"
      description="Card disputes on Bid payments. Allocate each one to the right invoices before the deadline."
      Link={ListLink}
      listKey="bid-admin.disputes"
      views={
        <DataViews views={disputesViews(search, props.counts)} activeId={view} Link={ListLink} />
      }
      search={
        <TableSearch
          key={q}
          fullWidth
          label="Search disputes"
          placeholder="Search lot, buyer, seller or case ID"
          value={q}
          onSearch={(next) => navigate(disputesListHref(search, { q: next || null }))}
        />
      }
      filters={
        <FilterSheet
          title="Filter disputes"
          description="Status is set by the tabs above the list."
          sections={[
            {
              kind: "radio",
              id: "reason",
              label: "Reason",
              anyLabel: "Any reason",
              options: DISPUTE_REASON_FILTERS,
              value: reason,
            },
          ]}
          onApply={(values) =>
            navigate(disputesListHref(search, { reason: (values.reason as string) || null }))
          }
        />
      }
      activeFilters={chips}
      onClearFilters={() => navigate(disputesListHref(search, { q: null, reason: null }))}
      loading={pending}
      filtered={props.filtered}
      error={
        props.loadError
          ? {
              title: "Disputes couldn't be loaded",
              description: props.loadError,
              onRetry: () => navigate(disputesListHref(search, {})),
            }
          : null
      }
      empty={{
        title: copy.title,
        description: copy.description,
        ...(emptyAction ? { action: emptyAction } : {}),
      }}
      noResults={{ noun: "disputes" }}
      table={{
        label: "Disputes",
        columns,
        data: rows,
        getRowId: (row) => row.id,
        // The first cell carries a second line, which needs 44px rows.
        defaultDensity: "comfortable",
        defaultHiddenColumns: ["opened"],
        defaultSort: { columnId: "deadline", direction: "asc" },
        onRowOpen: (row) => navigate(disputeCaseHref(row.id)),
        rowActions: {
          label: (row) => `Actions for dispute ${row.title}, ${row.reason}`,
          actions: (row) => [
            { id: "open", label: "Open case", href: disputeCaseHref(row.id) },
            { id: "stripe", label: "Open in Stripe", href: disputeStripeHref(row.stripeDisputeId) },
            {
              id: "copy",
              label: "Copy case ID",
              onSelect: () => {
                void navigator.clipboard
                  ?.writeText(row.stripeDisputeId)
                  .then(() => notify.success("Case ID copied"))
                  .catch(() => notify.error("Could not copy the case ID"));
              },
            },
          ],
        },
      }}
      pageSize={{
        value: props.pageSize,
        onChange: (size) => navigate(disputesListHref(search, { limit: size })),
      }}
      pagination={props.pagination}
    />
  );
}
