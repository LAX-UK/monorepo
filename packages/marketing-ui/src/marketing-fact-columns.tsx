import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingFact = {
  id: string;
  icon: ReactNode;
  label: string;
  /** One entry per line; entries may be links. */
  lines: readonly ReactNode[];
};

export type MarketingFactColumnsProps = {
  facts: readonly MarketingFact[];
  ariaLabel: string;
  className?: string;
};

/**
 * Centred icon facts in up to three columns (Figma exhibition location, viewing and contact,
 * `743:20964`). Facts without lines are dropped so a missing venue never leaves an empty column.
 */
export function MarketingFactColumns({ facts, ariaLabel, className }: MarketingFactColumnsProps) {
  const shown = facts.filter((fact) => fact.lines.length > 0);
  if (shown.length === 0) return null;
  return (
    <dl
      aria-label={ariaLabel}
      className={cn("m-0 grid gap-8 text-center sm:grid-flow-col sm:auto-cols-fr", className)}
      data-testid="marketing-fact-columns"
    >
      {shown.map((fact) => (
        <div key={fact.id} className="flex flex-col items-center gap-3">
          <dt className="flex flex-col items-center gap-2 font-label text-xs uppercase tracking-wider text-on-surface">
            {fact.icon}
            {fact.label}
          </dt>
          <dd className="m-0 flex flex-col items-center gap-1 text-sm text-on-surface-variant">
            {fact.lines.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fact lines are positional.
              <span key={index}>{line}</span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
