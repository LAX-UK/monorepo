"use client";

import { Button, EmptyState, type EmptyStateProps } from "@auction/ui/lax";

/** The card every Team and Organisation list state sits in, so the page keeps its shape. */
const CARD = "overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface";

/** A list with nothing in it yet: the drawing, why it is empty, and the one next step. */
export function TeamListEmpty(props: EmptyStateProps) {
  return (
    <div className={CARD}>
      <EmptyState headingLevel="h2" {...props} />
    </div>
  );
}

/** A search or filter that matches nothing, with one way back to the whole list. */
export function TeamListNoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className={CARD}>
      <EmptyState
        headingLevel="h2"
        illustration="search"
        title={query ? `No results for “${query}”` : "No one matches these filters"}
        description={
          query ? "Check the spelling or clear filters." : "Clear filters to see everyone."
        }
        actions={<Button onClick={onClear}>Clear filters</Button>}
      />
    </div>
  );
}
