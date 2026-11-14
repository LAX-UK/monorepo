"use client";

import { useWorkList } from "@/components/use-work-list.client";
import { orderNumber } from "@/server/domain/order-list.vm";
import { disputeOrderHref, disputesList } from "@/server/domain/sales-lists.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminDisputeList, AdminDisputeListItem } from "@auction/shop-contracts";
import {
  type DataColumn,
  ListPage,
  MappedStatusBadge,
  PersonCell,
  PrimaryCell,
  StaffDate,
  StaffMoney,
  toast,
} from "@auction/staff-ui";
import { Copy, ReceiptText } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useMemo } from "react";

const presentDisputeStatus = presentStatus("dispute");

function copyReference(dispute: AdminDisputeListItem) {
  void navigator.clipboard
    ?.writeText(dispute.stripeDisputeId)
    .then(() => toast.success("Dispute reference copied"));
}

/**
 * Card disputes on the staff list template: a view per status with counts, search by order
 * number, dispute reference or buyer, newest first on the server. A dispute has no page of its
 * own: a row opens the order it was raised on, at its payment, where staff act on it.
 */
export function DisputesList({
  state,
  page,
  loadFailed = false,
}: {
  state: WorkListState<never>;
  page: AdminDisputeList;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: disputesList,
    state,
    page,
    noun: { one: "dispute", other: "disputes" },
    search: {
      label: "Search disputes",
      placeholder: "Search by order number, dispute reference or buyer",
    },
  });
  const rowHref = useCallback(
    (row: AdminDisputeListItem) => disputesList.recordHref(state, disputeOrderHref(row)),
    [state],
  );

  const columns = useMemo<DataColumn<AdminDisputeListItem>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "128px",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <span className="tabular-nums">
            <PrimaryCell href={rowHref(row)} Link={Link}>
              {orderNumber(row.orderId, row.orderReference)}
            </PrimaryCell>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "112px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentDisputeStatus} />,
      },
      {
        id: "buyer",
        header: "Buyer",
        mobile: "meta",
        cell: (row) =>
          row.buyerName || row.buyerEmail ? (
            <PersonCell
              name={row.buyerName ?? row.buyerEmail ?? ""}
              secondary={row.buyerName ? row.buyerEmail : null}
            />
          ) : null,
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffMoney minor={row.amountPence} />,
      },
      {
        id: "opened",
        header: "Opened",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.openedAt} withTime />,
      },
      {
        id: "closed",
        header: "Closed",
        width: "184px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.closedAt ? <StaffDate value={row.closedAt} withTime /> : null),
      },
    ],
    [rowHref],
  );

  return (
    <ListPage<AdminDisputeListItem>
      title="Disputes"
      description="Card disputes raised against an order, newest first. Open one to see the order it was raised on."
      Link={list.Link}
      listKey="lax-admin.disputes"
      views={list.views}
      search={list.search}
      activeFilters={list.searchChip}
      onClearFilters={list.clearFilters}
      loading={list.pending}
      filtered={list.filtered}
      error={
        loadFailed
          ? {
              title: "Disputes did not load",
              description: "Something went wrong on our side. Try again in a moment.",
              onRetry: () => list.navigate(disputesList.href(state)),
            }
          : null
      }
      empty={{
        illustration: "ledger",
        title: state.view === "opened" ? "No open disputes" : "No disputes",
        description: "Card disputes raised against an order will be listed here.",
      }}
      noResults={{ noun: "disputes" }}
      table={{
        columns,
        data: page.items,
        getRowId: (row) => row.disputeId,
        defaultDensity: "comfortable",
        defaultHiddenColumns: ["closed"],
        ...list.sort,
        rowHref,
        rowActions: {
          label: (row) =>
            `Actions for the dispute on order ${orderNumber(row.orderId, row.orderReference)}`,
          actions: (row) => [
            { id: "order", label: "Open order", icon: ReceiptText, href: rowHref(row) },
            {
              id: "copy",
              label: "Copy dispute reference",
              icon: Copy,
              onSelect: () => copyReference(row),
            },
          ],
        },
      }}
      pageSize={list.pageSize}
      pagination={list.pagination}
    />
  );
}
