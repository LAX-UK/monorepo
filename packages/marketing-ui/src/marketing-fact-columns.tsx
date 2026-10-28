import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingFact = {
  id: string;
  icon: ReactNode;
  label: string;
  /** One entry per line; entries may be links. */
  lines: readonly ReactNode[];
  /** Extra classes on the fact's wrapper, e.g. to hide it at one breakpoint. */
  className?: string;
};

export type MarketingFactColumnsProps = {
  facts: readonly MarketingFact[];
  ariaLabel: string;
  /**
   * `columns` centres up to three facts side by side (exhibition facts, `743:20964`). `list`
   * stacks left-aligned rows with the icon beside the text (venue location, `821:11603`).
   */
  layout?: "columns" | "list";
  className?: string;
};

/**
 * Icon facts for an exhibition or a venue. Facts without lines are dropped so a missing venue
 * never leaves an empty column or row.
 */
export function MarketingFactColumns({
  facts,
  ariaLabel,
  layout = "columns",
  className,
}: MarketingFactColumnsProps) {
  const shown = facts.filter((fact) => fact.lines.length > 0);
  if (shown.length === 0) return null;
  const stacked = layout === "list";
  return (
    <dl
      aria-label={ariaLabel}
      className={cn(
        "m-0",
        stacked ? "flex flex-col gap-6" : "grid gap-8 text-center sm:grid-flow-col sm:auto-cols-fr",
        className,
      )}
      data-testid="marketing-fact-columns"
    >
      {shown.map((fact) => (
        // A definition-list group holds only its term and description; the icon sits inside the term.
        <div
          key={fact.id}
          className={cn(
            "flex min-w-0 flex-col",
            stacked ? "relative gap-1 pl-10" : "items-center gap-3",
            fact.className,
          )}
        >
          <dt
            className={cn(
              "flex font-label text-sm font-medium",
              stacked ? "text-on-surface-variant" : "flex-col items-center gap-2 text-on-surface",
            )}
          >
            {fact.icon ? (
              <span
                aria-hidden
                className={stacked ? "absolute left-0 top-0.5 text-on-surface-variant" : undefined}
              >
                {fact.icon}
              </span>
            ) : null}
            {fact.label}
          </dt>
          <dd
            className={cn(
              "m-0 flex flex-col gap-1",
              stacked
                ? "text-base text-on-surface md:text-lg"
                : "items-center text-sm text-on-surface-variant",
            )}
          >
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
