"use client";

import { FulfilmentEditForm } from "@/components/orders/fulfilment-section.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import {
  type FulfilmentRow,
  fulfilmentOrderHref,
  fulfilmentTrackingLabel,
} from "@/server/domain/fulfilment-list.vm";
import {
  fulfilmentNextOptions,
  fulfilmentOptionLabel,
  presentFulfilmentStatus,
} from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import { fulfilmentList } from "@/server/domain/sales-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import { ADMIN_FULFILMENT_OPTIONS, type AdminFulfilmentList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PanelSection,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  formatStaffDateTime,
  toast,
} from "@auction/staff-ui";
import { ArrowUpRight, Copy, PanelRight, ReceiptText, Truck } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo, useState } from "react";

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  open: {
    title: "Nothing to fulfil",
    description: "Paid orders that still need making, shipping or collecting appear here.",
  },
  awaiting_dispatch: {
    title: "Nothing waiting to dispatch",
    description: "Orders ready to send appear here once production is done.",
  },
  in_transit: {
    title: "Nothing in transit",
    description: "Orders appear here once they are handed to the carrier.",
  },
  ready_for_collection: {
    title: "Nothing waiting for collection",
    description: "Orders the customer collects appear here once they are ready.",
  },
  done: {
    title: "Nothing finished yet",
    description: "Delivered, collected, stored and cancelled fulfilments appear here.",
  },
};

/**
 * Fulfilment on the staff list template: what is still to make, ship or collect first, a view
 * per step with counts, a delivery filter, search by order number, tracking or buyer, the last
 * change as the server sort, and a record panel linked from the URL (`?fulfilment=`) where the
 * order is moved on without leaving the list.
 */
export function FulfilmentList({
  state,
  page,
  loadFailed = false,
}: {
  state: WorkListState<"option">;
  page: AdminFulfilmentList;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: fulfilmentList,
    state,
    page,
    noun: { one: "fulfilment", other: "fulfilments" },
    search: {
      label: "Search fulfilment",
      placeholder: "Search by order number, tracking number or buyer",
    },
  });
  const [dirty, setDirty] = useState(false);
  const opened = page.items.find((row) => row.fulfilmentId === list.panel.openId) ?? null;
  const nextOptions = opened ? fulfilmentNextOptions(opened.status) : [];

  const columns = useMemo<DataColumn<FulfilmentRow>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "128px",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <span className="tabular-nums">
            <PrimaryCell href={list.panelHref(row.fulfilmentId)} Link={list.panel.PanelLink}>
              {orderNumber(row.orderId, row.orderReference)}
            </PrimaryCell>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "184px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentFulfilmentStatus} />,
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
        id: "option",
        header: "Delivery",
        width: "232px",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => fulfilmentOptionLabel(row.option),
      },
      {
        id: "tracking",
        header: "Tracking",
        width: "200px",
        truncate: "middle",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => fulfilmentTrackingLabel(row),
      },
      {
        id: "updated",
        header: "Last change",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const optionChip = filterChip(
    fulfilmentList,
    state,
    list.navigate,
    "option",
    (value) => `Delivery: ${fulfilmentOptionLabel(value)}`,
  );
  const empty = EMPTY_COPY[state.view] ?? {
    title: "No fulfilments yet",
    description: "A fulfilment starts as soon as an order is paid.",
  };

  const rowActions = (row: FulfilmentRow): OverflowAction[] => [
    {
      id: "open",
      label: "Open details",
      icon: PanelRight,
      onSelect: () => list.panel.show(row.fulfilmentId),
    },
    ...(fulfilmentNextOptions(row.status).length > 0
      ? [
          {
            id: "move",
            label: "Move on…",
            icon: Truck,
            onSelect: () => list.panel.show(row.fulfilmentId),
          },
        ]
      : []),
    { id: "order", label: "Open order", icon: ReceiptText, href: fulfilmentOrderHref(row.orderId) },
    ...(row.trackingNumber
      ? [
          {
            id: "copy",
            label: "Copy tracking number",
            icon: Copy,
            onSelect: () => {
              void navigator.clipboard
                ?.writeText(row.trackingNumber ?? "")
                .then(() => toast.success("Tracking number copied"));
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <ListPage<FulfilmentRow>
        title="Fulfilment"
        description="What is still to be made, shipped or collected. Open a row to move its order on, add tracking or record possession."
        Link={list.Link}
        listKey="lax-admin.fulfilment"
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter fulfilment"
            sections={[
              {
                kind: "radio",
                id: "option",
                label: "Delivery",
                anyLabel: "Any delivery",
                options: ADMIN_FULFILMENT_OPTIONS.map((option) => ({
                  value: option,
                  label: fulfilmentOptionLabel(option),
                })),
                value: state.filters.option ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                fulfilmentList.href(state, { option: (values.option as string) || null }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...optionChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Fulfilment did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(fulfilmentList.href(state)),
              }
            : null
        }
        empty={{ illustration: "parcel", ...empty }}
        noResults={{ noun: "fulfilments" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.fulfilmentId,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["tracking"],
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.fulfilmentId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for order ${orderNumber(row.orderId, row.orderReference)}`,
            actions: rowActions,
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDirty(false);
            list.panel.show(null);
          }
        }}
        dirty={dirty}
        dirtyLabel="this fulfilment"
        title={
          opened ? `Order ${orderNumber(opened.orderId, opened.orderReference)}` : "Fulfilment"
        }
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentFulfilmentStatus} />
          ) : null
        }
        headerActions={
          opened ? (
            <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
              <Link href={fulfilmentOrderHref(opened.orderId)}>Open order</Link>
            </StaffButton>
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Delivery", value: fulfilmentOptionLabel(opened.option) },
                {
                  label: "Last change",
                  value: formatStaffDateTime(opened.updatedAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Buyer", value: opened.buyerName ?? opened.buyerEmail ?? null },
                {
                  label: "Tracking",
                  value: fulfilmentTrackingLabel(opened),
                  ...(opened.trackingNumber ? { copyValue: opened.trackingNumber } : {}),
                },
                {
                  label: "Possession",
                  value: opened.possessionAt
                    ? formatStaffDateTime(opened.possessionAt, { zoneLabel: true })
                    : "Not recorded",
                },
                {
                  label: "Paid",
                  value: opened.paidAt
                    ? formatStaffDateTime(opened.paidAt, { zoneLabel: true })
                    : null,
                },
              ])
            : []
        }
      >
        {opened && nextOptions.length > 0 ? (
          <PanelSection title="Next step">
            <FulfilmentEditForm
              key={opened.fulfilmentId}
              fulfilment={{
                fulfilmentId: opened.fulfilmentId,
                status: opened.status,
                carrier: opened.carrier,
                trackingNumber: opened.trackingNumber,
                possessionAt: opened.possessionAt ?? null,
              }}
              paidAt={opened.paidAt ?? null}
              onDirtyChange={setDirty}
              cancelLabel={null}
              onDone={() => {
                setDirty(false);
                list.panel.show(null);
              }}
            />
          </PanelSection>
        ) : null}
      </DetailPanel>
    </>
  );
}
