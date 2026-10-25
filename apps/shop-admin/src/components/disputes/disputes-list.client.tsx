"use client";

import { knownFacts, useWorkList } from "@/components/use-work-list.client";
import { orderNumber } from "@/server/domain/order-list.vm";
import { disputesList } from "@/server/domain/sales-lists.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminDisputeList, AdminDisputeListItem } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  ListPage,
  MappedStatusBadge,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StaffMoney,
  formatStaffDateTime,
  formatStaffMoney,
  toast,
} from "@auction/staff-ui";
import { ArrowUpRight, Copy, PanelRight, ReceiptText } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

const presentDisputeStatus = presentStatus("dispute");

function copyReference(dispute: AdminDisputeListItem) {
  void navigator.clipboard
    ?.writeText(dispute.stripeDisputeId)
    .then(() => toast.success("Dispute reference copied"));
}

const orderHref = (dispute: AdminDisputeListItem) => `/orders/${dispute.orderId}`;

/**
 * Card disputes on the staff list template: a view per status with counts, search by order
 * number, dispute reference or buyer, newest first on the server, and a record panel linked from
 * the URL (`?dispute=`) that leads to the order.
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
  const opened = page.items.find((item) => item.disputeId === list.panel.openId) ?? null;

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
            <PrimaryCell href={list.panelHref(row.disputeId)} Link={list.panel.PanelLink}>
              {orderNumber(row.orderId)}
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
    [list.panelHref, list.panel.PanelLink],
  );

  return (
    <>
      <ListPage<AdminDisputeListItem>
        title="Disputes"
        description="Card disputes raised against an order, newest first. Open one to see the order it concerns."
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
        noResults={{
          title: "No disputes match",
          description: "Try another order number or reference, or clear the search.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.disputeId,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["closed"],
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.disputeId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the dispute on order ${orderNumber(row.orderId)}`,
            actions: (row) => [
              {
                id: "open",
                label: "Open details",
                icon: PanelRight,
                onSelect: () => list.panel.show(row.disputeId),
              },
              { id: "order", label: "Open order", icon: ReceiptText, href: orderHref(row) },
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

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? `Dispute on order ${orderNumber(opened.orderId)}` : "Dispute"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentDisputeStatus} />
          ) : null
        }
        headerActions={
          opened ? (
            <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
              <Link href={orderHref(opened)}>Open order</Link>
            </StaffButton>
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Amount", value: formatStaffMoney(opened.amountPence) },
                {
                  label: "Opened",
                  value: formatStaffDateTime(opened.openedAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Buyer", value: opened.buyerName ?? null },
                {
                  label: "Buyer email",
                  value: opened.buyerEmail ?? null,
                  ...(opened.buyerEmail ? { copyValue: opened.buyerEmail } : {}),
                },
                {
                  label: "Closed",
                  value: opened.closedAt
                    ? formatStaffDateTime(opened.closedAt, { zoneLabel: true })
                    : null,
                },
                {
                  label: "Dispute reference",
                  value: opened.stripeDisputeId,
                  copyValue: opened.stripeDisputeId,
                },
              ])
            : []
        }
      >
        {null}
      </DetailPanel>
    </>
  );
}
