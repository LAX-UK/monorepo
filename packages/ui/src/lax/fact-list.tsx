import type * as React from "react";
import { cn } from "../lib/utils.js";

export type Fact = {
  label: string;
  value: React.ReactNode;
};

/**
 * A short list of labelled facts, as a valid description list: every row is a `div` holding one
 * `dt` and one `dd`. The label sits beside the value from 448px up and above it below that, with a
 * hairline between rows. For catalogue details, terms and summaries that are read, not scanned.
 */
export function FactList({
  facts,
  className,
}: {
  facts: readonly Fact[];
  className?: string;
}) {
  if (facts.length === 0) return null;
  return (
    <dl className={cn("@container m-0 border-b border-lax-line-subtle", className)}>
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="grid grid-cols-1 gap-0.5 border-t border-lax-line-subtle py-3 @md:grid-cols-[10rem_minmax(0,1fr)] @md:gap-6"
        >
          <dt className="text-lax-14 text-lax-muted">{fact.label}</dt>
          <dd className="m-0 min-w-0 text-lax-14 text-lax-fg [overflow-wrap:anywhere]">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
