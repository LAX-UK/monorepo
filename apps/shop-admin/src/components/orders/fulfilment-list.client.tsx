"use client";

import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  type FulfilmentRow,
  fulfilmentOrderHref,
  fulfilmentTrackingLabel,
} from "@/server/domain/fulfilment-list.vm";
import { fulfilmentOptionLabel, presentFulfilmentStatus } from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import type { AdminFulfilmentList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  TablePagination,
  formatStaffDateTime,
  useTableDensity,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

/**
 * Fulfilments still to be shipped or collected. A row opens its order, where the Fulfilment
 * section moves it on; nothing here asks for an id.
 */
export function FulfilmentList({
  page,
  cursor,
}: {
  page: AdminFulfilmentList;
  cursor: string | null;
}) {
  const router = useRouter();
  const { pending, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("fulfilment");

  const columns = useMemo<DataColumn<FulfilmentRow>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "112px",
        mobile: "title",
        cell: (row) => (
          <Link
            href={fulfilmentOrderHref(row.orderId)}
            className="staff-focus rounded-staff-xs font-medium text-staff-fg tabular-nums hover:underline"
          >
            {orderNumber(row.orderId)}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "176px",
        mobile: "badge",
        cell: (row) => <MappedStatusBadge status={row.status} present={presentFulfilmentStatus} />,
      },
      {
        id: "option",
        header: "Delivery",
        mobile: "meta",
        cell: (row) => fulfilmentOptionLabel(row.option),
      },
      {
        id: "tracking",
        header: "Tracking",
        truncate: "middle",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => fulfilmentTrackingLabel(row) ?? <span className="text-staff-subtle">—</span>,
      },
      {
        id: "updated",
        header: "Updated",
        width: "176px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.updatedAt,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => <time dateTime={row.updatedAt}>{formatStaffDateTime(row.updatedAt)}</time>,
      },
    ],
    [],
  );

  return (
    <DataTable
      label="Open fulfilments"
      columns={columns}
      data={page.items}
      getRowId={(row) => row.fulfilmentId}
      defaultSort={{ columnId: "updated", direction: "desc" }}
      density={density}
      loading={pending}
      onRowOpen={(row) => router.push(fulfilmentOrderHref(row.orderId))}
      toolbar={<DataTableToolbar end={<DensityToggle value={density} onChange={setDensity} />} />}
      empty={
        <EmptyState
          title="Nothing to fulfil"
          description="Paid orders that still need shipping or collection will appear here."
        />
      }
      footer={
        page.items.length > 0 ? (
          <TablePagination
            summary={`${page.items.length} ${page.items.length === 1 ? "fulfilment" : "fulfilments"} on this page`}
            prevHref={cursor ? "/fulfilment" : null}
            prevLabel="First page"
            nextHref={
              page.nextCursor ? `/fulfilment?cursor=${encodeURIComponent(page.nextCursor)}` : null
            }
            Link={ListLink}
          />
        ) : null
      }
    />
  );
}
