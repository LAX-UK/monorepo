"use client";

import { ListPagination } from "@/components/list-pagination.client";
import { ProductionFilters } from "@/components/production/production-filters.client";
import { ProductionTaskList } from "@/components/production/production-task-list.client";
import {
  PRODUCTION_LIST_PATH,
  type ProductionQueueQuery,
  hasActiveProductionFilters,
  productionQueueHref,
  productionQueuePageHref,
} from "@/server/domain/production-queue.vm";
import type { AdminProductionTaskList, ProductionTaskStaff } from "@auction/shop-contracts";
import { Button, EmptyState, TableSkeleton } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * The filterable queue. Filter and paging moves run in a transition, which is how the loading
 * state shows without a `loading.tsx` above a route that navigates by query string.
 */
export function ProductionQueue({
  query,
  page,
  assignees,
  currentSubject,
}: {
  query: ProductionQueueQuery;
  page: AdminProductionTaskList;
  assignees: ProductionTaskStaff[];
  currentSubject: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  );
  const filtered = hasActiveProductionFilters(query);

  return (
    <section aria-label="Production tasks" aria-busy={pending} className="flex flex-col gap-6">
      {/* Keyed by the search text so "Clear filters" also empties the search box. */}
      <ProductionFilters
        key={query.q ?? ""}
        query={query}
        counts={page.counts}
        navigate={navigate}
      />
      {pending ? (
        <output className="block">
          <span className="sr-only">Loading production tasks</span>
          <TableSkeleton rows={6} columns={4} />
        </output>
      ) : page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            headingLevel="h3"
            title="No tasks match these filters"
            description="Try a different search, or clear the filters to see every task."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(PRODUCTION_LIST_PATH)}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            headingLevel="h3"
            title="No production tasks"
            description="Create a task with the form above when an edition needs to be made."
          />
        )
      ) : (
        <ProductionTaskList
          items={page.items}
          assignees={assignees}
          currentSubject={currentSubject}
        />
      )}
      {pending ? null : (
        <ListPagination
          firstHref={query.cursor ? productionQueueHref(query) : null}
          nextHref={page.nextCursor ? productionQueuePageHref(query, page.nextCursor) : null}
          navigate={navigate}
        />
      )}
    </section>
  );
}
