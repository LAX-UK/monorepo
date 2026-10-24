"use client";

import { OrderQuickView } from "@/components/orders/order-quick-view.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { createSavedViewsPort } from "@/lib/saved-views-port.client";
import { presentOrderStatus } from "@/server/domain/order-detail.vm";
import {
  CREATED_PRESETS,
  ORDER_LIST_PATH,
  ORDER_STATUS_LABELS,
  type OrderListQuery,
  createdPresetRange,
  createdRangeLabel,
  hasActiveOrderFilters,
  matchCreatedPreset,
  orderBuyerName,
  orderBuyerSecondary,
  orderListHref,
  orderListPageHref,
  orderNumber,
  orderTeamViews,
} from "@/server/domain/order-list.vm";
import { ADMIN_ORDER_SEARCH_MAX_LENGTH, type AdminOrderList } from "@auction/shop-contracts";
import {
  ActiveFilterChips,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  NoResultsState,
  StaffButton,
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuTrigger,
  TablePagination,
  TableSearch,
  formatGbp,
  formatStaffDateTime,
  toast,
  useSavedViews,
  useTableDensity,
} from "@auction/staff-ui";
import { CalendarDays, Copy, Download } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo, useState } from "react";

type OrderRow = AdminOrderList["items"][number];

const ORDERS_LIST_KEY = "lax-admin.orders";

const STATUS_VIEWS = ["paid", "pending_payment", "partially_refunded", "refunded"] as const;

function ordersCsv(rows: OrderRow[]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = ["Order", "Buyer", "Email", "Status", "Total", "Created"];
  const lines = rows.map((row) =>
    [
      orderNumber(row.orderId),
      orderBuyerName(row),
      row.buyerEmail ?? "",
      ORDER_STATUS_LABELS[row.status as keyof typeof ORDER_STATUS_LABELS] ?? row.status,
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
 * The orders list: views by status (with counts), saved views, search, a created-date filter,
 * sortable columns, row selection with bulk export, and a quick-view panel on Enter or click.
 * Every filter is in the URL, so a view can be bookmarked and shared.
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
  const [density, setDensity] = useTableDensity("orders");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const port = useMemo(() => createSavedViewsPort(ORDERS_LIST_KEY), []);
  const saved = useSavedViews(ORDERS_LIST_KEY, port, { legacyStorageKey: "staff.views.orders" });
  const filtered = hasActiveOrderFilters(query);
  const today = useMemo(() => new Date(now), [now]);
  const teamViews = useMemo(() => orderTeamViews(today), [today]);
  const activePreset = matchCreatedPreset(query, today);
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
  const activeView = query.status ?? "all";

  const columns = useMemo<DataColumn<OrderRow>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "112px",
        mobile: "title",
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
        id: "status",
        header: "Status",
        width: "148px",
        mobile: "badge",
        cell: (row) => <MappedStatusBadge status={row.status} present={presentOrderStatus} />,
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
        numeric: true,
        sortable: true,
        sortValue: (row) => row.createdAt,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => (
          <time dateTime={row.createdAt} className="text-staff-muted">
            {formatStaffDateTime(row.createdAt)}
          </time>
        ),
      },
    ],
    [],
  );

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
    ...(createdRangeLabel(query)
      ? [
          {
            id: "created",
            label: createdRangeLabel(query) ?? "",
            onRemove: () => navigate(orderListHref(query, { from: null, to: null })),
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        label="Orders"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.orderId}
        defaultSort={{ columnId: "created", direction: "desc" }}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenOrderId(row.orderId)}
        activeRowId={openOrderId}
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        bulkNoun={{ one: "order", other: "orders" }}
        bulkActions={(rows) => (
          <>
            <StaffButton
              size="sm"
              variant="ghost"
              icon={<Download aria-hidden />}
              onClick={() => {
                download(`orders-${now.slice(0, 10)}.csv`, ordersCsv(rows));
                toast.success(`Exported ${rows.length} ${rows.length === 1 ? "order" : "orders"}`);
              }}
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
        )}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={views}
                activeId={activeView}
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
                label="Search orders"
                placeholder="Order number, buyer name or email"
                value={query.q ?? ""}
                onSearch={(q) =>
                  navigate(
                    orderListHref(query, { q: q.slice(0, ADMIN_ORDER_SEARCH_MAX_LENGTH) || null }),
                  )
                }
              />
            }
            filters={
              <StaffMenu>
                <StaffMenuTrigger asChild>
                  <StaffButton size="sm" variant="secondary" icon={<CalendarDays aria-hidden />}>
                    Created
                  </StaffButton>
                </StaffMenuTrigger>
                <StaffMenuContent align="start" className="w-52">
                  <StaffMenuLabel>Created</StaffMenuLabel>
                  {CREATED_PRESETS.map((preset) => (
                    <StaffMenuCheckboxItem
                      key={preset.id}
                      checked={activePreset === preset.id}
                      onCheckedChange={(checked) =>
                        navigate(
                          orderListHref(
                            query,
                            checked
                              ? createdPresetRange(preset.id, today)
                              : { from: null, to: null },
                          ),
                        )
                      }
                    >
                      {preset.label}
                    </StaffMenuCheckboxItem>
                  ))}
                </StaffMenuContent>
              </StaffMenu>
            }
            activeFilters={
              <ActiveFilterChips
                filters={activeFilters}
                onClearAll={() => navigate(orderListHref({}, {}))}
              />
            }
            end={<DensityToggle value={density} onChange={setDensity} />}
          />
        }
        empty={
          filtered ? (
            <NoResultsState
              title="No orders match these filters"
              description="Try a different search or date range, or clear the filters to see every order."
              action={
                <StaffButton size="sm" onClick={() => navigate(ORDER_LIST_PATH)}>
                  Clear filters
                </StaffButton>
              }
            />
          ) : (
            <EmptyState
              title="No orders yet"
              description="Orders appear here as soon as a customer completes checkout."
            />
          )
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "order" : "orders"} on this page`}
              prevHref={query.cursor ? orderListHref(query) : null}
              prevLabel="First page"
              nextHref={page.nextCursor ? orderListPageHref(query, page.nextCursor) : null}
              Link={ListLink}
            />
          ) : null
        }
      />
      <OrderQuickView orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </>
  );
}
