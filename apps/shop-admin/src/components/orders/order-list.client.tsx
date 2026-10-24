"use client";

import { OrderQuickView } from "@/components/orders/order-quick-view.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { createSavedViewsPort } from "@/lib/saved-views-port.client";
import { presentOrderStatus } from "@/server/domain/order-detail.vm";
import {
  ADMIN_ORDER_STATUSES,
  CREATED_PRESETS,
  ORDER_LIST_PATH,
  ORDER_STATUS_LABELS,
  type OrderListQuery,
  createdRangeLabel,
  hasActiveOrderFilters,
  orderBuyerName,
  orderBuyerSecondary,
  orderListHref,
  orderListPageHref,
  orderNumber,
  orderTeamViews,
} from "@/server/domain/order-list.vm";
import {
  ADMIN_ORDER_SEARCH_MAX_LENGTH,
  type AdminOrderList,
  type AdminOrderStatus,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  DataViews,
  DateRangeFilter,
  type DateRangePreset,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  StaffButton,
  TableSearch,
  daysBefore,
  formatGbp,
  formatStaffDateTime,
  londonToday,
  toast,
  useSavedViews,
} from "@auction/staff-ui";
import { Copy, Download } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo, useState } from "react";

type OrderRow = AdminOrderList["items"][number];

const ORDERS_LIST_KEY = "lax-admin.orders";

const STATUS_VIEWS = ["paid", "pending_payment", "partially_refunded", "refunded"] as const;

/** The created-date presets, counted in whole UK days ending today. */
const CREATED_RANGE_PRESETS: DateRangePreset[] = CREATED_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  range: (today: string) => ({ from: daysBefore(today, preset.days - 1), to: today }),
}));

function ordersCsv(rows: readonly OrderRow[]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = ["Order", "Buyer", "Email", "Status", "Total", "Created"];
  const lines = rows.map((row) =>
    [
      orderNumber(row.orderId),
      orderBuyerName(row),
      row.buyerEmail ?? "",
      ORDER_STATUS_LABELS[row.status as AdminOrderStatus] ?? row.status,
      (row.totalPence / 100).toFixed(2),
      row.createdAt,
    ]
      .map(String)
      .map(quote)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The orders list on the staff list template: status views (with counts) and saved views, search,
 * a status filter, the created date as the period, bulk export and copy, a `…` menu on each row,
 * and a quick view on Enter or click. Every filter is in the URL, so a view can be shared.
 */
export function OrderList({
  query,
  page,
  now,
}: {
  query: OrderListQuery;
  page: AdminOrderList;
  /** The server's clock, so presets match on the server and in the browser. */
  now: string;
}) {
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const port = useMemo(() => createSavedViewsPort(ORDERS_LIST_KEY), []);
  const saved = useSavedViews(ORDERS_LIST_KEY, port, { legacyStorageKey: "staff.views.orders" });
  const filtered = hasActiveOrderFilters(query);
  const serverNow = useMemo(() => new Date(now), [now]);
  const today = londonToday(serverNow);
  const teamViews = useMemo(() => orderTeamViews(serverNow), [serverNow]);
  const total = Object.values(page.counts).reduce((sum, count) => sum + count, 0);
  const currentQuery = orderListHref(query).split("?")[1] ?? "";

  const views = [
    { id: "all", label: "All", href: orderListHref(query, { status: null }), count: total },
    ...STATUS_VIEWS.map((status) => ({
      id: status,
      label: ORDER_STATUS_LABELS[status],
      href: orderListHref(query, { status }),
      count: page.counts[status] ?? 0,
    })),
  ];

  const exportRows = (rows: readonly OrderRow[]) => {
    download(`orders-${now.slice(0, 10)}.csv`, ordersCsv(rows));
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? "order" : "orders"}`);
  };

  const columns = useMemo<DataColumn<OrderRow>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "112px",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <Link
            href={`/orders/${row.orderId}`}
            className="staff-focus rounded-staff-xs font-medium text-staff-fg tabular-nums hover:underline"
          >
            {orderNumber(row.orderId)}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "148px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentOrderStatus} />,
      },
      {
        id: "buyer",
        header: "Buyer",
        mobile: "meta",
        cell: (row) => {
          const secondary = orderBuyerSecondary(row);
          return (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">{orderBuyerName(row)}</span>
              {secondary ? (
                <span className="hidden truncate text-staff-xs text-staff-muted lg:inline">
                  {secondary}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "total",
        header: "Total",
        width: "112px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.totalPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => formatGbp(row.totalPence),
      },
      {
        id: "created",
        header: "Created",
        width: "176px",
        sortable: true,
        sortValue: (row) => row.createdAt,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => (
          <time dateTime={row.createdAt} className="text-staff-muted tabular-nums">
            {formatStaffDateTime(row.createdAt)}
          </time>
        ),
      },
    ],
    [],
  );

  const createdLabel = createdRangeLabel(query);
  const activeFilters = [
    ...(query.q
      ? [
          {
            id: "q",
            label: `“${query.q}”`,
            onRemove: () => navigate(orderListHref(query, { q: null })),
          },
        ]
      : []),
    ...(query.status
      ? [
          {
            id: "status",
            label: `Status: ${ORDER_STATUS_LABELS[query.status]}`,
            onRemove: () => navigate(orderListHref(query, { status: null })),
          },
        ]
      : []),
    ...(createdLabel
      ? [
          {
            id: "created",
            label: createdLabel,
            onRemove: () => navigate(orderListHref(query, { from: null, to: null })),
          },
        ]
      : []),
  ];

  return (
    <>
      <ListPage<OrderRow>
        title="Orders"
        description="Every Shop and lax.art order, newest first. Open one to refund, update fulfilment or send it to production."
        Link={ListLink}
        listKey="orders"
        secondaryActions={
          page.items.length > 0 ? (
            <StaffButton
              size="sm"
              variant="secondary"
              icon={<Download aria-hidden />}
              onClick={() => exportRows(page.items)}
            >
              Export page
            </StaffButton>
          ) : null
        }
        views={
          <DataViews
            views={views}
            activeId={query.status ?? "all"}
            Link={ListLink}
            team={teamViews}
            saved={saved}
            savedHref={(view) => `${ORDER_LIST_PATH}?${view.query}`}
            currentQuery={filtered ? currentQuery : ""}
          />
        }
        search={
          <TableSearch
            key={query.q ?? ""}
            fullWidth
            label="Search orders"
            placeholder="Search by order number, buyer name or email"
            value={query.q ?? ""}
            onSearch={(q) =>
              navigate(
                orderListHref(query, { q: q.slice(0, ADMIN_ORDER_SEARCH_MAX_LENGTH) || null }),
              )
            }
          />
        }
        filters={
          <FilterSheet
            title="Filter orders"
            today={today}
            sections={[
              {
                kind: "radio",
                id: "status",
                label: "Status",
                anyLabel: "Any status",
                options: ADMIN_ORDER_STATUSES.map((status) => ({
                  value: status,
                  label: ORDER_STATUS_LABELS[status],
                  ...(page.counts[status] !== undefined ? { count: page.counts[status] } : {}),
                })),
                value: query.status ?? "",
              },
            ]}
            onApply={(values) =>
              navigate(
                orderListHref(query, {
                  status: (values.status as AdminOrderStatus | "") || null,
                }),
              )
            }
          />
        }
        period={
          <DateRangeFilter
            label="Created"
            today={today}
            presets={CREATED_RANGE_PRESETS}
            value={{ from: query.from ?? "", to: query.to ?? "" }}
            onChange={(range) =>
              navigate(orderListHref(query, { from: range.from || null, to: range.to || null }))
            }
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(ORDER_LIST_PATH)}
        loading={pending}
        filtered={filtered}
        empty={{
          title: "No orders yet",
          description: "Orders appear here as soon as a customer completes checkout.",
        }}
        noResults={{
          title: "No orders match these filters",
          description:
            "Try a different search or date range, or clear the filters to see every order.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.orderId,
          defaultSort: { columnId: "created", direction: "desc" },
          onRowOpen: (row) => setOpenOrderId(row.orderId),
          activeRowId: openOrderId,
          selectedIds: selected,
          onSelectedIdsChange: setSelected,
          bulkNoun: { one: "order", other: "orders" },
          bulkActions: (rows) => (
            <>
              <StaffButton
                size="sm"
                variant="ghost"
                icon={<Download aria-hidden />}
                onClick={() => exportRows(rows)}
              >
                Export CSV
              </StaffButton>
              <StaffButton
                size="sm"
                variant="ghost"
                icon={<Copy aria-hidden />}
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(rows.map((row) => orderNumber(row.orderId)).join("\n"))
                    .then(() => toast.success("Order numbers copied"));
                }}
              >
                Copy numbers
              </StaffButton>
            </>
          ),
          rowActions: {
            label: (row) => `Actions for order ${orderNumber(row.orderId)}`,
            actions: (row) => [
              { id: "preview", label: "Quick view", onSelect: () => setOpenOrderId(row.orderId) },
              { id: "open", label: "Open order", href: `/orders/${row.orderId}` },
              {
                id: "copy",
                label: "Copy order number",
                onSelect: () => {
                  void navigator.clipboard
                    ?.writeText(orderNumber(row.orderId))
                    .then(() => toast.success("Order number copied"));
                },
              },
            ],
          },
        }}
        pagination={
          page.items.length > 0
            ? {
                summary: `${page.items.length} ${page.items.length === 1 ? "order" : "orders"} on this page`,
                prevHref: query.cursor ? orderListHref(query) : null,
                prevLabel: "First page",
                nextHref: page.nextCursor ? orderListPageHref(query, page.nextCursor) : null,
              }
            : null
        }
      />
      <OrderQuickView orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </>
  );
}
