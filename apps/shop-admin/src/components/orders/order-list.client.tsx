"use client";

import { ListPagination } from "@/components/list-pagination.client";
import { OrderFilters } from "@/components/orders/order-filters.client";
import { OrderListTable } from "@/components/orders/order-list-table.client";
import {
  ORDER_LIST_PATH,
  type OrderListQuery,
  hasActiveOrderFilters,
  orderListHref,
  orderListPageHref,
} from "@/server/domain/order-list.vm";
import type { AdminOrderList } from "@auction/shop-contracts";
import { Button, EmptyState, TableSkeleton } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * The filterable orders list. Filter and paging moves run in a transition, which is how the
 * loading state shows without a `loading.tsx` above a route that navigates by query string.
 */
export function OrderList({ query, page }: { query: OrderListQuery; page: AdminOrderList }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  );
  const filtered = hasActiveOrderFilters(query);

  return (
    <section aria-label="Orders" aria-busy={pending} className="flex flex-col gap-6">
      {/* Keyed by the search text so "Clear filters" also empties the search box. */}
      <OrderFilters key={query.q ?? ""} query={query} counts={page.counts} navigate={navigate} />
      {pending ? (
        <output className="block">
          <span className="sr-only">Loading orders</span>
          <TableSkeleton rows={6} columns={5} />
        </output>
      ) : page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            headingLevel="h2"
            title="No orders match these filters"
            description="Try a different search or date range, or clear the filters to see every order."
            action={
              <Button type="button" variant="outline" onClick={() => navigate(ORDER_LIST_PATH)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            headingLevel="h2"
            title="No orders yet"
            description="Orders appear here as soon as a customer completes checkout."
          />
        )
      ) : (
        <OrderListTable items={page.items} />
      )}
      {pending ? null : (
        <ListPagination
          firstHref={query.cursor ? orderListHref(query) : null}
          nextHref={page.nextCursor ? orderListPageHref(query, page.nextCursor) : null}
          navigate={navigate}
        />
      )}
    </section>
  );
}
