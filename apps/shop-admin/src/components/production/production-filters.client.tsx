"use client";

import { TransitionLink } from "@/components/enquiries/transition-link.client";
import { SelectField, TextField } from "@/components/forms/fields";
import {
  PRODUCTION_ASSIGNEE_LABELS,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_TASK_STATUSES,
  type ProductionAssigneeFilter,
  type ProductionQueueQuery,
  productionQueueHref,
} from "@/server/domain/production-queue.vm";
import { PRODUCTION_TASK_SEARCH_MAX_LENGTH } from "@auction/shop-contracts";
import { Button, FilterRow } from "@auction/ui";
import { type FormEvent, useState } from "react";

/** The blank value is "no filter"; SelectField swaps it for a sentinel Radix accepts. */
const ASSIGNEE_OPTIONS: ReadonlyArray<{ value: ProductionAssigneeFilter | ""; label: string }> = [
  { value: "", label: "Anyone" },
  ...(Object.keys(PRODUCTION_ASSIGNEE_LABELS) as ProductionAssigneeFilter[]).map((value) => ({
    value,
    label: PRODUCTION_ASSIGNEE_LABELS[value],
  })),
];

/**
 * Every control writes to the URL, so a filtered queue can be bookmarked, shared and reloaded.
 * `navigate` runs the move in the caller's transition so the list can show a loading state.
 */
export function ProductionFilters({
  query,
  counts,
  navigate,
}: {
  query: ProductionQueueQuery;
  counts: Record<string, number>;
  navigate: (href: string) => void;
}) {
  const [search, setSearch] = useState(query.q ?? "");
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const statusItems = [
    { id: "all", label: "All", badge: total, status: null, active: !query.status },
    ...PRODUCTION_TASK_STATUSES.map((status) => ({
      id: status,
      label: PRODUCTION_STATUS_LABELS[status],
      badge: counts[status] ?? 0,
      status,
      active: query.status === status,
    })),
  ].map(({ status, ...item }) => ({ ...item, href: productionQueueHref(query, { status }) }));

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(productionQueueHref(query, { q: search.trim() || null }));
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
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <SelectField
          name="assignee"
          label="Assignee"
          value={query.assignee ?? ""}
          options={ASSIGNEE_OPTIONS}
          onChange={(assignee) =>
            navigate(productionQueueHref(query, { assignee: assignee || null }))
          }
        />
        <form
          aria-label="Search production tasks"
          onSubmit={onSearch}
          className="flex items-end gap-2"
        >
          <TextField
            name="search"
            label="Search"
            className="min-w-0 flex-1"
            value={search}
            onChange={setSearch}
            maxLength={PRODUCTION_TASK_SEARCH_MAX_LENGTH}
            placeholder="Artwork title, order number or task ID"
          />
          <Button type="submit" variant="outline" size="md">
            Search
          </Button>
        </form>
      </div>
    </div>
  );
}
