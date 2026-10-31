"use client";

import { Button, EmptyState, type EmptyStateProps, Notice, Skeleton } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** The card every list state sits in, so the page keeps its shape whatever the list holds. */
const CARD = "overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface";

/** A list with nothing in it yet: the drawing, why it is empty, and the one next step. */
export function ListEmpty(props: EmptyStateProps) {
  return (
    <div className={CARD}>
      <EmptyState headingLevel="h2" {...props} />
    </div>
  );
}

/**
 * A search or filter that matches nothing: what matched nothing, and one way back to the whole
 * list.
 */
export function ListNoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className={CARD}>
      <EmptyState
        illustration="search"
        title={query ? `No results for “${query}”` : "No results for these filters"}
        description={
          query ? "Check the spelling or clear filters." : "Clear filters to see the whole list."
        }
        actions={<Button onClick={onClear}>Clear filters</Button>}
      />
    </div>
  );
}

/**
 * A list that did not load: said calmly, on our side, with one way to try again. The rest of the
 * page keeps working.
 */
export function ListLoadError({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = onRetry ?? (() => startTransition(() => router.refresh()));
  return (
    <Notice
      tone="danger"
      alert
      title="We couldn't load this list."
      actions={
        <Button onClick={retry} loading={pending}>
          Try again
        </Button>
      }
    >
      Nothing is lost. Try again in a moment.
    </Notice>
  );
}

const ROWS = ["a", "b", "c", "d"] as const;

/** The list loading: rows of the size that is coming, so nothing jumps when it arrives. */
export function ListSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <output aria-label={label} className={`block ${CARD}`}>
      <ul className="divide-y divide-lax-line">
        {ROWS.slice(0, rows).map((key) => (
          <li key={key} className="flex items-center gap-4 px-4 py-3 md:px-5">
            <Skeleton className="size-12 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-48 max-w-full" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-6 w-24 md:block" />
          </li>
        ))}
      </ul>
    </output>
  );
}
