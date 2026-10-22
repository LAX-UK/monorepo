"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { orderBuyerName, orderBuyerSecondary, orderNumber } from "@/server/domain/order-list.vm";
import type { AdminOrderList } from "@auction/shop-contracts";
import { EntityTableShell } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

type OrderRow = AdminOrderList["items"][number];

function OrderLink({ order }: { order: OrderRow }) {
  return (
    <Link
      href={`/orders/${order.orderId}`}
      className="font-medium text-on-surface underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {orderNumber(order.orderId)}
    </Link>
  );
}

function Buyer({ order }: { order: OrderRow }) {
  const secondary = orderBuyerSecondary(order);
  return (
    <div className="min-w-0">
      <p className="truncate text-on-surface">{orderBuyerName(order)}</p>
      {secondary ? <p className="truncate text-xs text-on-surface-variant">{secondary}</p> : null}
    </div>
  );
}

function Created({ order }: { order: OrderRow }) {
  return (
    <time dateTime={order.createdAt} className="whitespace-nowrap">
      {formatAdminDetailDateTime(order.createdAt)}
    </time>
  );
}

/**
 * The orders as a table from `lg` upwards and as cards below it. Both link to the order page,
 * where refunds and line cancellations live. The caller handles the empty case.
 */
export function OrderListTable({ items }: { items: OrderRow[] }) {
  const columns = useMemo<ColumnDef<OrderRow, unknown>[]>(
    () => [
      { id: "order", header: "Order", cell: ({ row }) => <OrderLink order={row.original} /> },
      { id: "buyer", header: "Buyer", cell: ({ row }) => <Buyer order={row.original} /> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => formatAdminDetailGbpPence(row.original.totalPence),
      },
      { id: "created", header: "Created", cell: ({ row }) => <Created order={row.original} /> },
    ],
    [],
  );

  return (
    <EntityTableShell
      table={
        <AdminStaffDataTable
          ariaLabel="Orders"
          columns={columns}
          data={items}
          getRowId={(row) => row.orderId}
          empty={{ title: "No orders", description: "Nothing to show." }}
        />
      }
      cards={
        <ul aria-label="Orders" className="flex flex-col gap-3">
          {items.map((order) => (
            <li
              key={order.orderId}
              className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <OrderLink order={order} />
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-3 text-sm">
                <Buyer order={order} />
              </div>
              <p className="mt-3 flex justify-between gap-3 text-xs text-on-surface-variant">
                <Created order={order} />
                <span className="text-sm text-on-surface">
                  {formatAdminDetailGbpPence(order.totalPence)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      }
    />
  );
}
