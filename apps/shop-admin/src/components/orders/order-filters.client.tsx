"use client";

import { TransitionLink } from "@/components/enquiries/transition-link.client";
import { TextField } from "@/components/forms/fields";
import {
  ADMIN_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderListQuery,
  orderListHref,
} from "@/server/domain/order-list.vm";
import { ADMIN_ORDER_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";
import { Button, DateRangePicker, FilterRow } from "@auction/ui";
import { type FormEvent, useState } from "react";

/**
 * Every control writes to the URL, so a filtered list can be bookmarked, shared and reloaded.
 * `navigate` runs the move in the caller's transition so the list can show a loading state.
 */
export function OrderFilters({
  query,
  counts,
  navigate,
}: {
  query: OrderListQuery;
  counts: Record<string, number>;
  navigate: (href: string) => void;
}) {
  const [search, setSearch] = useState(query.q ?? "");
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const statusItems = [
    { id: "all", label: "All", badge: total, status: null, active: !query.status },
    ...ADMIN_ORDER_STATUSES.map((status) => ({
      id: status,
      label: ORDER_STATUS_LABELS[status],
      badge: counts[status] ?? 0,
      status,
      active: query.status === status,
    })),
  ].map(({ status, ...item }) => ({ ...item, href: orderListHref(query, { status }) }));

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(orderListHref(query, { q: search.trim() || null }));
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterRow
        mode="link"
        label="Status"
        items={statusItems}
        renderLink={({ href, className, children, ...aria }) => (
          <TransitionLink href={href} className={className} navigateTo={navigate} {...aria}>
            {children}
          </TransitionLink>
        )}
      />
      <form
        aria-label="Search orders"
        onSubmit={onSearch}
        className="flex max-w-xl items-end gap-2"
      >
        <TextField
          name="search"
          label="Search"
          className="min-w-0 flex-1"
          value={search}
          onChange={setSearch}
          maxLength={ADMIN_ORDER_SEARCH_MAX_LENGTH}
          placeholder="Order number, buyer name or email"
        />
        <Button type="submit" variant="outline" size="md">
          Search
        </Button>
      </form>
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-on-surface">Created</legend>
        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker
            value={{ from: query.from ?? "", to: query.to ?? "" }}
            initialPreset={null}
            onChange={({ from, to }) =>
              navigate(orderListHref(query, { from: from || null, to: to || null }))
            }
          />
          {query.from || query.to ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => navigate(orderListHref(query, { from: null, to: null }))}
            >
              Clear dates
            </Button>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}
